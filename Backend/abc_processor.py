"""
ABC Call Processor Service (Cart Recovery)
Handles filtering Pre-Purchase vs Post-Purchase and full analysis for ABC Cart Recovery calls.
"""

import json
import uuid
import time
import pandas as pd
import math
from typing import Optional, Dict, List, Tuple, Any
from datetime import datetime
from audio_processor import AudioDownloader, GeminiAudioAnalyzer, PromptTemplate
import google.generativeai as genai
import os
from dotenv import load_dotenv
from abc_service import save_abc_call_to_mongodb, save_abc_discarded_call

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MODEL_NAME_LITE = os.getenv("MODEL_LITE", "gemini-flash-lite-latest")
MODEL_NAME_FULL = os.getenv("MODEL", "gemini-2.0-flash")

if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY not found in .env file")

genai.configure(api_key=GEMINI_API_KEY)


class AbcCSVValidator:
    """Validates CSV structure for ABC call uploads"""

    # Based on the user provided image of headers
    REQUIRED_COLUMNS = [
        'Billing Phone',
        'Billing City',
        'Billing Zip',
        'Lineitem price',
        'LeadCreatedDate',
        'CallStartDateTime',
        'CallAudio'
        # 'is_Converted' is likely optional or derived
    ]

    @staticmethod
    def validate(df: pd.DataFrame) -> Tuple[bool, Optional[str]]:
        """
        Validate CSV has required columns.
        Returns: (is_valid, error_message)
        """
        missing = [col for col in AbcCSVValidator.REQUIRED_COLUMNS if col not in df.columns]

        if missing:
            return False, f"Missing columns: {', '.join(missing)}"

        if len(df) == 0:
            return False, "CSV is empty"

        return True, None


class AbcIntentFilter:
    """Filters ABC calls into Pre-Purchase and Post-Purchase using cheap model"""

    def __init__(self, api_key: str, model: str = MODEL_NAME_LITE):
        self.model_name = model
        self.api_key = api_key
        
        generation_config = genai.GenerationConfig(
            temperature=0.1,
            top_p=0.95,
            max_output_tokens=500,
            response_mime_type="application/json"
        )
        
        self.model = genai.GenerativeModel(
            model_name=model,
            generation_config=generation_config
        )

    def classify_call_type(self, audio_data: bytes) -> Tuple[Optional[str], Optional[str]]:
        """
        Quickly classify if call is Pre-Purchase or Post-Purchase.
        """
        try:
            import tempfile
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp.write(audio_data)
                tmp_path = tmp.name

            try:
                audio_file = genai.upload_file(tmp_path)
                
                prompt = """Analyze this Cart Recovery call and respond with ONLY valid JSON:
{
    "call_type": "PRE_PURCHASE or POST_PURCHASE",
    "confidence": 0.0 to 1.0,
    "reason": "brief reason"
}

Context: This is a call to a customer who abandoned their online shopping cart.
- PRE_PURCHASE: Customer has NOT bought yet, is deciding, has issues, or just thinking.
- POST_PURCHASE: Customer states they have ALREADY purchased the item (online or in store) or bought a competitor product.

Listen for:
- PRE: "Payment failed", "still deciding", "looking", "expensive", "need demo"
- POST: "Already bought", "placed order", "delivered", "bought from store", "got it"

Return only the JSON object."""

                response = self.model.generate_content([prompt, audio_file])
                genai.delete_file(audio_file.name)
                
                result_text = response.text.strip()
                try:
                    result = json.loads(result_text)
                    call_type = result.get("call_type", "").upper()
                    
                    if "PRE_PURCHASE" in call_type or "PRE-PURCHASE" in call_type:
                        return "PRE_PURCHASE", None
                    elif "POST_PURCHASE" in call_type or "POST-PURCHASE" in call_type:
                        return "POST_PURCHASE", None
                    else:
                        return None, f"Could not classify call type: {call_type}"
                except json.JSONDecodeError:
                    if "post" in result_text.lower() and "purchase" in result_text.lower():
                        return "POST_PURCHASE", None
                    return "PRE_PURCHASE", None # Default to PRE if unsure to be safe
                    
            finally:
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)

        except Exception as e:
            print(f"[ABC FILTER] Classification error: {e}")
            return None, f"Classification failed: {e}"


class AbcCallProcessor:
    """Orchestrates ABC CSV upload → Filtering → Full Analysis → MongoDB storage"""

    def __init__(self):
        self.audio_downloader = AudioDownloader()
        self.intent_filter = AbcIntentFilter(GEMINI_API_KEY, MODEL_NAME_LITE)
        self.analyzer_full = GeminiAudioAnalyzer(GEMINI_API_KEY, MODEL_NAME_FULL)
        
        self.job_id = str(uuid.uuid4())
        self.processed_calls = []
        self.discarded_calls = []
        self.job_status = {
            "job_id": self.job_id,
            "status": "pending",
            "total_records": 0,
            "processed": 0,
            "successful": 0,
            "failed": 0,
            "filtered_out": 0,
            "errors": []
        }

    def process_csv_file(self, csv_file_path: str, rate_limit_delay: float = 2.0) -> str:
        """Process CSV file with Pre/Post-Purchase filtering."""
        try:
            df = pd.read_csv(csv_file_path)
            
            # Normalize Headers (Strip whitespace)
            df.columns = df.columns.str.strip()
            
            is_valid, error = AbcCSVValidator.validate(df)
            if not is_valid:
                raise ValueError(error)

            self.job_status["total_records"] = len(df)
            self.job_status["status"] = "processing"

            print(f"[ABC] Starting processing of {len(df)} records. Model used: {MODEL_NAME_FULL}")

            for index, row in df.iterrows():
                try:
                    self._process_single_row(row, index + 2) # +2 for 1-based index including header
                    time.sleep(rate_limit_delay) 
                except Exception as e:
                    print(f"[ABC] Error processing row {index}: {e}")
                    self._add_error(index, "Unknown", str(e))
                
                self.job_status["processed"] += 1

            self.job_status["status"] = "completed"
            return self.job_id
            
        except ValueError as ve:
            self.job_status["status"] = "failed"
            self.job_status["errors"].append({"row": 0, "error": str(ve)})
            return self.job_id
        except Exception as e:
            self.job_status["status"] = "failed"
            self.job_status["errors"].append({"row": 0, "error": f"Critical failure: {str(e)}"})
            return self.job_id

    def _process_single_row(self, row: pd.Series, row_num: int):
        phone = str(row.get('Billing Phone', ''))
        city = str(row.get('Billing City', ''))
        audio_url = str(row.get('CallAudio', ''))
        agent_name = str(row.get('Agent_Name', row.get('AgentName', 'Unknown Agent')))  # Extract agent name from CSV
        call_id = f"abc_call_{uuid.uuid4().hex[:8]}" # Generate ID if not present

        if not audio_url or pd.isna(audio_url) or audio_url == 'nan':
            self._add_error(row_num, phone, "Missing audio URL")
            return

        # 1. Download Audio
        audio_data, download_error = self.audio_downloader.download(audio_url)
        if not audio_data:
            self._add_error(row_num, phone, download_error or "Failed to download audio")
            return

        # 2. Extract First 20 Seconds for Filtering
        # TODO: If a precise 20s trim is required, add a byte-level trim utility or use pydub.
        # For now, we pass the full audio bytes to the lite model.

        # 3. Classify Call Type
        call_type, filter_error = self.intent_filter.classify_call_type(audio_data)

        record = {
          "call_id": call_id,
          "phone": phone,
          "city": city,
          "agent_name": agent_name,  # Save agent name from CSV
          "audio_url": audio_url,
          "recording_url": audio_url,  # For Drive upload compatibility
          "processed_at": datetime.now().isoformat(),
          "call_type_detected": call_type,
          "raw_data": row.to_dict()
        }

        if call_type == "POST_PURCHASE":
          print(f"[ABC] Row {row_num}: Classified as POST_PURCHASE. Discarding.")
          self.discarded_calls.append(record)
          self.job_status["filtered_out"] += 1
          save_abc_discarded_call(record)
          return

        if call_type is None:
          print(f"[ABC] Row {row_num}: Classification failed ({filter_error}). Proceeding as PRE_PURCHASE.")

        # 4. Full Analysis for Pre-Purchase
        prompt = self._create_prompt_template(row, record)

        analysis_result, analysis_error = self.analyzer_full.analyze_with_prompt(audio_data, prompt)

        if analysis_result:
          record["analysis"] = analysis_result
          self.processed_calls.append(record)
          self.job_status["successful"] += 1
          save_abc_call_to_mongodb(record)
          print(f"[ABC] Row {row_num}: Successfully processed.")
        else:
          self._add_error(row_num, phone, analysis_error or "Analysis failed (Gemini returned empty)")

    def _create_prompt_template(self, row: pd.Series, record: Dict) -> str:
        """Create the ABC analysis prompt with call context"""
        
        # Extract headers (mapping CSV to Prompt fields)
        customer_name = row.get('Customer_Name', 'Not Specified')
        cart_value = row.get('Lineitem price', 'Unknown')
        abandonment_date = row.get('LeadCreatedDate', 'Unknown')
        call_date = row.get('CallStartDateTime', 'Unknown')
        phone = row.get('Billing Phone', 'Unknown')
        city = row.get('Billing City', 'Unknown')
        locality = row.get('Locality', 'Unknown')
        zip_code = row.get('Billing Zip', 'Unknown')
        store_name = row.get('Store_Name', 'Central CX Team')

        # Keep the output schema in a non-f-string so curly braces don't get interpreted
        # by Python's f-string formatter.
        output_schema = """{
  \"MetaData\": {
    \"Customer_Name\": \"String\",
    \"Customer_Location\": \"String\",
    \"Customer_Language\": \"String\",
    \"Customer_Gender\": \"Male | Female | Unknown\",
    \"Customer_Age_Group\": \"Young Adult | Middle Aged | Senior | Unknown\",
    \"Consideration_Value\": \"String (e.g. 'Premium Range' or 'Budget')\",
    \"Call_Quality_Overall\": \"High | Medium | Low\",
    \"Call_Duration\": \"String\",
    \"Connected_to_Customer\": true,
    \"Customer_Enthusiasm\": \"High | Medium | Low\"
  },
  \"Call_Summary\": \"String (Max 150 words - Focus on the store feedback and call outcome)\",
  \"1_Call_Objective\": {
    \"Type\": \"Store Walk-in Recovery | Post-Purchase Check\",
    \"Objective_Phrase\": \"String\"
  },
  \"2_Intent_to_Purchase\": {
    \"Rating\": \"High | Medium | Low\",
    \"Reason\": \"String (Evidence based)\"
  },
  \"3_Store_Experience\": {
    \"Rating\": \"High | Medium | Low\",
    \"Reason\": \"String (Why did they leave without buying? Staff/Stock/Price?)\"
  },
  \"4_Call_Experience\": {
    \"Rating\": \"High | Medium | Low\",
    \"Reason\": \"String (How well did the agent handle the feedback?)\"
  },
  \"5_Funnel_Analysis\": {
    \"Stage\": \"Awareness | Consideration | Action | Already Purchased\",
    \"Reason\": \"String (State evidence based reasoning for the stage you are defining)\",
    \"Timeline_to_Purchase\": \"Immediate | Short Term | Long Term | Unknown\"
  },
  \"6_Product_Intelligence\": {
    \"Narrow_Down_Stage\": \"Category | Range | Specific SKU | NA\",
    \"Product_of_Interest\": \"String\",
    \"Approx_Order_Value\": \"String (or NA)\"
  },
  \"7_Customer_Needs\": {
    \"Description\": \"String (Who is it for? Key pain points? Constraints?)\"
  },
  \"8_Purchase_Barriers\": {
    \"At_Store\": \"String (Why they walked out?)\",
    \"On_Call\": \"String (Why they aren't buying now?)\"
  },
  \"9_Decision_Maker\": \"Caller | Spouse | Joint | Unknown\",
  \"10_Invitations\": {
    \"Home_Measurement\": {
      \"Rating\": \"High | Medium | Low\",
      \"Reason\": \"String (Did agent suggest sending a technician?)\"
    }
  },
  \"11_Conversion_Hooks\": {
    \"Offers_Discounts_EMI\": {\"Status\": \"Yes | No\", \"Comment\": \"String (Did they offer a 'Manager's Discount'?)\"},
    \"Product_Brochure\": {\"Status\": \"Yes | No\", \"Comment\": \"String\"},
    \"Mattress_Measurement\": {\"Status\": \"Yes | No\", \"Comment\": \"String\"},
    \"Brand_Legacy_Warranty\": {\"Status\": \"Yes | No\", \"Comment\": \"String\"},
    \"Sleep_Trial\": {\"Status\": \"Yes | No\", \"Comment\": \"String\"}
  },
  \"12_RELAX_Framework\": {
    \"R_Reach_Out\": {\"Score\": \"H/M/L\", \"Reason\": \"Context setting (Mentioning the store visit)\"},
    \"E_Explore_Needs\": {\"Score\": \"H/M/L\", \"Reason\": \"Probing for walk-out reason\"},
    \"L_Link_Product\": {\"Score\": \"H/M/L\", \"Reason\": \"Re-affirming store demo experience\"},
    \"A_Add_Value\": {\"Score\": \"H/M/L\", \"Reason\": \"Offering Home Measure/Discount\"},
    \"X_Express_Closing\": {\"Score\": \"H/M/L\", \"Reason\": \"Next steps/Appointment Setting\"}
  },
  \"13_Agent_Evaluation\": {
    \"Main_Skills\": {
      \"Product_Knowledge\": \"High | Medium | Low\",
      \"Sales_Skills\": \"High | Medium | Low\",
      \"Upsell_Revenue_Skills\": \"High | Medium | Low\"
    },
    \"Secondary_Traits\": {
      \"Need_Discovery\": \"High | Medium | Low\",
      \"Objection_Handling\": \"High | Medium | Low\",
      \"Agent_Nature\": \"Proactive | Responsive | Passive\"
    }
  },
  \"14_Agent_Learnings\": [\"String (Feedback 1)\", \"String (Feedback 2)\", \"String (Feedback 3)\"],
  \"15_Next_Actions\": \"String (e.g. Schedule Technician Visit, Send Brochure)\",
  \"16_End_to_end_NPS\": {\"Score\": \"Integer (0-10)\", \"Comment\": \"String (For the Call Experience)\"},
  \"Transcript_Log\": \"String (Full Transcript)\"
}"""
        
        full_prompt = f"""Role: You are an Expert Cart Recovery Specialist & Auditor for Duroflex.
Task: Analyze the provided Audio Recording of an Outbound Call made to a customer who abandoned their online checkout.
Goal: Extract high-fidelity sales intelligence by listening for "micro-hesitations," tonal shifts, and verbal cues to identify the true Reason for Abandonment and evaluate the agent's recovery tactics.

INPUT DATA
Audio Source: {{INPUT_AUDIO_FILE}} (Note: Process the raw audio to capture sentiment, interruptions, and emotional valence)

Call Metadata:
- Customer_Name: {customer_name}
- Cart_Value: ₹{cart_value}
- Abandonment_Date: {abandonment_date}
- Store_Name: {store_name}
- Location: {locality}, {city}
- Call_Date: {call_date}

INSTRUCTIONS
Acoustic Abandonment Analysis: Listen for "The Pause." When the agent mentions the cart items or price, does the customer hesitate? Use this to differentiate between "Price Sensitivity" (vocal dip/sigh) and "Technical Issue" (frustrated/flat tone).
Objection Detection: Evaluate how the agent handles the specific barrier. Listen for the "pivot"—does the agent's tone remain helpful or become pushy when the customer offers an excuse?
Vocal Metadata: Infer Customer_Gender, Customer_Age_Group, and Customer_Enthusiasm from pitch, cadence, and response speed.
Audio Quality Audit: Identify if background noise or poor connection (clipping/static) contributed to the customer's desire to end the call quickly.
Strict JSON: Output ONLY a valid JSON object matching the schema. No conversational filler or introductory text.

Output Schema (JSON)
{output_schema}
"""
        return full_prompt

    def _add_error(self, row_num: int, phone: str, error: str):
        self.job_status["failed"] += 1
        self.job_status["errors"].append({
            "row": row_num,
            "phone": phone,
            "error": error
        })

    def get_job_status(self, job_id: str = None) -> Dict:
        # Simple in-memory status (in production use Redis/DB)
        return self.job_status
