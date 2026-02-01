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
        
        full_prompt = f"""You are an expert Retail Operations & Sales Analyst for Duroflex.

## CONTEXT
You are analyzing an Abandoned Checkout (ABC) Recovery Call. 
Your analysis will populate a visual dashboard for the Head of Sales. The dashboard prioritizes:
1. **The Verdict:** Is this lead saved/hot, or lost?
2. **The Barrier:** Why did they drop off? (Price, Product, Tech)
3. **The Effort:** Did the agent try to get them into a Store or Video Call?

## CALL METADATA
- Customer_Name: {customer_name}
- Cart_Value: ₹{cart_value}
- Abandonment_Date: {abandonment_date}
- Store_Name: {store_name}
- Location: {locality}, {city}
- Call_Date: {call_date}

## RATING SCALE
- 1 (Poor/Not Attempted) to 5 (Excellent)

---

## PILLAR 1: LEAD STATUS & BARRIERS (The "Verdict")
**Purpose:** Determine if the sale is recoverable and what stopped it.

1. **Recovery_Outcome_Headline**: A short, punchy title summarizing the result (e.g., "Visit Scheduled for Jan 6th" or "Lost - Price too high").
2. **Lead_Status_Label**:
   - **HOT LEAD**: Visit scheduled or Purchase promised.
   - **NURTURING**: Interested but needs time/follow-up.
   - **COLD/LOST**: Not interested or bought elsewhere.
3. **Primary_Barrier**: The ONE main reason they didn't buy online (Price / Trust / Delivery / Tech Issue).
4. **Funnel_Stage_AIDA**: Where did the call end? (Awareness / Interest / Desire / Action).
5. **Intent_Gauge**: LOW / MEDIUM / HIGH.

---

## PILLAR 2: CONVERSION ATTEMPTS (The "Effort")
**Purpose:** Check if the agent pushed for specific conversion channels.

1. **Store_Visit_Invitation**:
   - Status: Invited & Accepted / Invited & Declined / Not Invited
   - Note: Did they emphasize "Touch & Feel"?
2. **Video_Call_Invitation**:
   - Status: Offered & Accepted / Offered & Declined / Not Offered
   - Note: Was it used as a fallback for customers who can't visit?
3. **Discount_Negotiation**:
   - Status: Offered / Discussed / Not Mentioned
   - Note: Did they use offers (bank offers, coupons) to close?

---

## PILLAR 3: RELAX FRAMEWORK (Methodology)
**Purpose:** Score the standard Duroflex methodology.
- **R (Reach Out)**: Professional greeting, identified brand?
- **E (Explore)**: Did they find the *real* reason for abandonment?
- **L (Link)**: Did they link the mattress benefits to that specific barrier?
- **A (Add Value)**: Did they calculate cost-per-night or offer EMI/Accessories?
- **X (Express)**: Clear next steps/closing?

---

## PILLAR 4: EXPERIENCE & SKILLS
**Purpose:** Soft skills assessment.
- **Customer_Sentiment**: Positive / Neutral / Negative.
- **Empathy_Score**: (1-5) Understanding the customer's hesitation.
- **Active_Listening_Score**: (1-5) Not interrupting, acknowledging concerns.
- **Objection_Handling_Score**: (1-5) Turning "It's too expensive" into value.
- **CSAT_Score**: (1-5) Overall customer satisfaction.

---

## OUTPUT FORMAT
Return ONLY a valid JSON object matching this exact schema:

{{
  "Header_Data": {{
    "Call_ID": "ABC_{store_name}_{call_date}_{{hash}}",
    "Audio_Quality_Rating": 0,
    "Lead_Status_Label": "HOT LEAD | NURTURING | COLD/LOST"
  }},
  "The_Verdict": {{
    "Recovery_Outcome_Headline": "String (Max 40 chars)",
    "Recovery_Outcome_Description": "String (1-2 sentences explaining the outcome)",
    "Primary_Barrier": "String",
    "Purchase_Intent": "LOW | MEDIUM | HIGH",
    "Funnel_Stage_AIDA": "Awareness | Interest | Desire | Action"
  }},
  "Conversion_Attempts": {{
    "Store_Visit": {{
      "Status": "Invited & Accepted | Invited & Declined | Not Invited",
      "Details": "String (Short note on how they asked)"
    }},
    "Video_Call": {{
      "Status": "Offered & Accepted | Offered & Declined | Not Offered",
      "Details": "String"
    }},
    "Discount_Offer": {{
      "Status": "Discussed | Not Discussed",
      "Details": "String"
    }}
  }},
  "RELAX_Framework": {{
    "R_Reach_Out": {{"Score": 0, "Reason": "String"}},
    "E_Explore": {{"Score": 0, "Reason": "String"}},
    "L_Link": {{"Score": 0, "Reason": "String"}},
    "A_Add_Value": {{"Score": 0, "Reason": "String"}},
    "X_Express": {{"Score": 0, "Reason": "String"}}
  }},
  "Experience_and_Skills": {{
    "CSAT_Score": 0,
    "Customer_Sentiment": "Positive | Neutral | Negative",
    "Sentiment_Reason": "String",
    "Soft_Skills": {{
      "Empathy_Score": 0,
      "Active_Listening_Score": 0,
      "Objection_Handling_Score": 0
    }}
  }},
  "Next_Actions": [
    "String (Action 1)",
    "String (Action 2)"
  ],
  "Summary_Narrative": "String (2-3 sentences summarizing the call logic)",
  "Transcript_Log": [
    {{"Speaker": "Agent/Customer", "Text": "...", "Timestamp": "00:00"}}
  ]
}}
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
