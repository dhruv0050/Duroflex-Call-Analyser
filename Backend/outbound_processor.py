"""
Outbound Call Processor Service
Handles filtering Pre-Purchase vs Post-Purchase and full analysis
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

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
# Cheap model for filtering (use a model that exists for v1beta/generateContent)
# You can override via MODEL_LITE in .env
MODEL_NAME_LITE = os.getenv("MODEL_LITE", "gemini-flash-lite-latest")
MODEL_NAME_FULL = os.getenv("MODEL", "gemini-2.0-flash")  # Full model for analysis

if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY not found in .env file")

genai.configure(api_key=GEMINI_API_KEY)


def sanitize_nan(obj):
    """Recursively replace NaN values with None for JSON serialization."""
    if isinstance(obj, dict):
        return {k: sanitize_nan(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_nan(item) for item in obj]
    elif isinstance(obj, float) and math.isnan(obj):
        return None
    return obj


class OutboundCSVValidator:
    """Validates CSV structure for outbound call uploads"""

    REQUIRED_COLUMNS = [
        'Store_Name__c',
        'Phone_Number__c',
        'Duration',
        'CallAudio',
        'CallStartDateTime',
        'CreatedDate',
        'Lead_Source'
    ]

    @staticmethod
    def validate(df: pd.DataFrame) -> Tuple[bool, Optional[str]]:
        """
        Validate CSV has required columns.
        Returns: (is_valid, error_message)
        """
        missing = [col for col in OutboundCSVValidator.REQUIRED_COLUMNS if col not in df.columns]

        if missing:
            return False, f"Missing columns: {', '.join(missing)}"

        if len(df) == 0:
            return False, "CSV is empty"

        return True, None


class PurchaseIntentFilter:
    """Filters calls into Pre-Purchase and Post-Purchase using cheap model"""

    def __init__(self, api_key: str, model: str = MODEL_NAME_LITE):
        """Initialize with lite model for quick filtering"""
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
        
        print(f"[FILTER] Initialized with model: {model}")

    def classify_call_type(self, audio_data: bytes, duration: int) -> Tuple[Optional[str], Optional[str]]:
        """
        Quickly classify if call is Pre-Purchase or Post-Purchase.
        
        Args:
            audio_data: Raw audio bytes
            duration: Call duration in seconds
        
        Returns: (call_type, error_message)
                call_type: "PRE_PURCHASE" or "POST_PURCHASE"
        """
        try:
            # Create temp file for audio
            import tempfile
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp.write(audio_data)
                tmp_path = tmp.name

            try:
                # Upload to Gemini
                print(f"[FILTER] Uploading audio for classification ({len(audio_data)} bytes)...")
                audio_file = genai.upload_file(tmp_path)
                
                # Classification prompt - very simple and fast
                prompt = """Analyze this call and respond with ONLY valid JSON:
{
    "call_type": "PRE_PURCHASE or POST_PURCHASE",
    "confidence": 0.0 to 1.0,
    "reason": "brief reason"
}

Context: This is a follow-up call from Duroflex to a customer who visited a store but didn't buy.
- PRE_PURCHASE: Customer is interested but hasn't decided yet, wants more info, has concerns to resolve, might still buy
- POST_PURCHASE: Customer already purchased from Duroflex or elsewhere, bought the product already, call is just check-in

Listen for language like:
- PRE_PURCHASE cues: "still thinking", "want to know", "comparing", "need time", "concerned about", "interested but"
- POST_PURCHASE cues: "already bought", "already have", "purchased", "delivered", "using", "happy with", "got it"

Return only the JSON object, no other text."""

                response = self.model.generate_content([prompt, audio_file])
                
                # Clean file
                genai.delete_file(audio_file.name)
                
                # Parse response
                result_text = response.text.strip()
                
                # Try to extract JSON
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
                    # Try to extract from text
                    if "post" in result_text.lower() and "purchase" in result_text.lower():
                        return "POST_PURCHASE", None
                    elif "pre" in result_text.lower() or "not" in result_text.lower() and "purchase" in result_text.lower():
                        return "PRE_PURCHASE", None
                    else:
                        return None, f"Could not parse response: {result_text}"
                        
            finally:
                # Clean up temp file
                import os
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)

        except Exception as e:
            print(f"[FILTER] Classification error: {str(e)}")
            return None, f"Classification failed: {str(e)}"


class OutboundCallUploadProcessor:
    """Orchestrates CSV upload → Filtering → Full Analysis → MongoDB storage"""

    def __init__(self):
        self.audio_downloader = AudioDownloader()
        self.intent_filter = PurchaseIntentFilter(GEMINI_API_KEY, MODEL_NAME_LITE)
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
        """
        Process CSV file with Pre/Post-Purchase filtering.
        
        Pipeline:
        1. Validate CSV structure
        2. For each row:
           a. Download audio
           b. Extract first 20 seconds
           c. Classify as PRE or POST purchase
           d. If PRE: Full analysis with Gemini
           e. If POST: Save to discarded_calls collection
        3. Return job_id
        """
        try:
            # Read CSV
            df = pd.read_csv(csv_file_path)
            
            # Validate
            is_valid, error_msg = OutboundCSVValidator.validate(df)
            if not is_valid:
                raise ValueError(error_msg)
            
            self.job_status["status"] = "processing"
            self.job_status["total_records"] = len(df)
            
            print(f"[OUTBOUND] Processing {len(df)} outbound call records...")
            
            for idx, row in df.iterrows():
                try:
                    row_num = idx + 2  # +2 for header and 1-based indexing
                    
                    # Extract row data
                    store_name = str(row.get('Store_Name__c', '')).strip()
                    recording_url = str(row.get('CallAudio', '')).strip()
                    duration_str = str(row.get('Duration', '0')).strip()
                    # Parse duration from HH:MM:SS format to seconds
                    if ':' in duration_str:
                        parts = duration_str.split(':')
                        if len(parts) == 3:
                            duration = int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
                        else:
                            duration = 0
                    else:
                        duration = int(duration_str) if duration_str.isdigit() else 0
                    
                    customer_phone = str(row.get('Phone_Number__c', '')).strip()
                    call_date = str(row.get('CallStartDateTime', '')).strip()
                    created_date = str(row.get('CreatedDate', '')).strip()
                    lead_source = str(row.get('Lead_Source', '')).strip()
                    is_converted = str(row.get('is_Converted', '0')).strip()

                    # Store Walkin CSV does not provide customer name
                    customer_name = None

                    print(f"\n[ROW {row_num}] {store_name} - {customer_phone}")
                    
                    # Generate unique call_id
                    import hashlib
                    call_id_hash = hashlib.md5(recording_url.encode()).hexdigest()[:8]
                    call_id = f"SWL_{store_name.replace(' ', '')}_{call_id_hash}"
                    
                    # Download audio
                    print(f"[OUTBOUND] Downloading audio...")
                    audio_data, dl_error = self.audio_downloader.download(recording_url)
                    
                    if audio_data is None:
                        self._add_error(row_num, store_name, dl_error or "Download failed")
                        continue
                    
                    # Extract first 20 seconds (20000ms = ~320KB at 128kbps, but we'll extract what we can)
                    print(f"[OUTBOUND] Classifying call type (first 20 seconds)...")
                    call_type, filter_error = self.intent_filter.classify_call_type(audio_data, duration)
                    
                    if call_type is None:
                        self._add_error(row_num, store_name, filter_error or "Classification failed")
                        continue
                    
                    # Create base record
                    base_record = {
                        "call_id": call_id,
                        "store_name": store_name,
                        "customer_phone": customer_phone,
                        "call_date": call_date,
                        "created_date": created_date,
                        "lead_source": lead_source,
                        "is_converted": is_converted,
                        "duration": duration,
                        "recording_url": recording_url,
                        "call_type": call_type,
                        "analyzed_at": datetime.now().isoformat()
                    }
                    
                    # If POST-PURCHASE, save to discarded and continue
                    if call_type == "POST_PURCHASE":
                        print(f"[OUTBOUND] Call is POST_PURCHASE - storing in discarded_calls")
                        base_record["discard_reason"] = "Post-purchase call - customer already bought"
                        self.discarded_calls.append(base_record)
                        self.job_status["filtered_out"] += 1
                        self.job_status["processed"] += 1
                        time.sleep(rate_limit_delay)
                        continue
                    
                    # PRE-PURCHASE: Do full analysis
                    print(f"[OUTBOUND] Call is PRE_PURCHASE - performing full analysis...")
                    
                    # Create fully formatted prompt with context
                    prompt_str = self._create_prompt_template(base_record)
                    
                    # Analyze using fully formatted prompt
                    try:
                        analysis, analysis_error = self.analyzer_full.analyze_with_prompt(
                            audio_data=audio_data,
                            prompt=prompt_str
                        )
                        
                        if analysis is None:
                            error_msg = analysis_error or "Analysis failed (returned None)"
                            print(f"[OUTBOUND] ❌ Analysis failed for row {row_num}: {error_msg}")
                            self._add_error(row_num, store_name, error_msg)
                            continue
                        
                        print(f"[OUTBOUND] ✅ Analysis completed for row {row_num}")
                        
                        # Store successful record
                        base_record["analysis"] = analysis
                        self.processed_calls.append(base_record)
                        self.job_status["successful"] += 1
                        self.job_status["processed"] += 1
                        
                        print(f"[OUTBOUND] ✓ Row {row_num} processed successfully")
                    except Exception as analysis_exc:
                        error_msg = f"Analysis exception: {str(analysis_exc)}"
                        print(f"[OUTBOUND] ❌ {error_msg}")
                        self._add_error(row_num, store_name, error_msg)
                        continue
                    
                    # Rate limiting
                    time.sleep(rate_limit_delay)
                    
                except Exception as row_error:
                    print(f"[ERROR ROW {row_num}] {str(row_error)}")
                    self._add_error(row_num, str(row.get('Store_Name__c', 'Unknown')), str(row_error))
            
            self.job_status["status"] = "completed"
            print(f"\n[OUTBOUND] Processing complete!")
            print(f"  Total: {self.job_status['total_records']}")
            print(f"  Processed: {self.job_status['processed']}")
            print(f"  Successful: {self.job_status['successful']}")
            print(f"  Filtered (Post-Purchase): {self.job_status['filtered_out']}")
            print(f"  Failed: {self.job_status['failed']}")
            
            return self.job_id
            
        except ValueError as ve:
            print(f"[OUTBOUND] Validation error: {str(ve)}")
            raise
        except Exception as e:
            print(f"[OUTBOUND] Processing error: {str(e)}")
            self.job_status["status"] = "error"
            raise

    def _create_prompt_template(self, call_record: Dict) -> str:
        """Create the analysis prompt with call context"""
        # This will be formatted with actual values
        return f"""You are an expert Retail Operations & Sales Analyst for Duroflex, a premium mattress and sleep solutions brand.

## CONTEXT
You are analyzing an Outbound Call made by a Duroflex Central Sales Agent to a customer who visited a Duroflex store but did not purchase. These customers experienced the products in-store, interacted with store staff, and left their contact details for follow-up. The Central Sales Team now calls to understand their barriers and nudge them toward successful purchase completion. Unlike online abandons, these customers have already physically tried the products — the agent must leverage this in-store experience.

## CALL & STORE VISIT CONTEXT
- Store_Name: {call_record.get('store_name', 'N/A')}
- Customer_Phone: {call_record.get('customer_phone', 'N/A')}
- Lead_Source: {call_record.get('lead_source', 'Store Walkin - Non Customer')}
- Created_Date: {call_record.get('created_date', 'N/A')}
- CallStartDateTime: {call_record.get('call_date', 'N/A')}
- Duration_Seconds: {call_record.get('duration', 'N/A')}
- is_Converted: {call_record.get('is_converted', '0')}

## RATING SCALE
- 1: Poor / Not Attempted
- 2: Below Average / Weak
- 3: Average / Acceptable
- 4: Good / Effective
- 5: Excellent / Exemplary

---

## PILLAR 1: DOUBLE AUDIT (Store + Call Experience)
**Purpose:** Assess BOTH the in-store experience AND the follow-up call quality from the customer's perspective.

### A. STORE AUDIT (Based on what customer mentions about their store visit)
- **Rating**: 1-5 (Customer's sentiment about their store experience)
- **Sentiment_Label**: Excellent / Positive / Neutral / Negative / Not Discussed
- **Specific_Feedback**: What did the customer specifically mention about their store visit? (Product demo, staff behavior, ambience, wait time, etc.)

### B. CALL AUDIT (Quality of this follow-up call)
- **Rating**: 1-5 (Overall quality of this call from customer's perspective)
- **Sentiment_Label**: Excellent / Positive / Neutral / Negative / Frustrated
- **Skill_Highlight**: What specific skill did the agent demonstrate well? (Problem Solving / Active Listening / Empathy / Product Knowledge / Persuasion / Patience)

---

## PILLAR 2: DIAGNOSIS (Understanding the Customer)
**Purpose:** Diagnose the core reason for not purchasing and the customer's decision-making context.

Evaluate:
- **Primary_WalkOut_Reason**: The ONE main reason customer didn't purchase at the store
  - Options: Price Concern / Product Confusion / Need Spouse Approval / Comparing Options / Budget Constraints / Size/Space Concerns / Delivery Timing / Just Browsing / Wanted Better Offer / Already Purchased Elsewhere / Not Disclosed

- **Primary_Barrier_Icon**: Categorize the barrier type
  - Options: Price / Product / Family / Timing / Trust / Other

- **Decision_Maker**: Who makes the final purchase decision?
  - Options: Self / Spouse / Joint / Family / Other

- **Timeline_Label**: When are they likely to purchase?
  - Options: Immediate / Short Term / Long Term / Uncertain / Not Purchasing

---

## PILLAR 3: RECOVERY HOOKS (What agent offered to bring customer back)
**Purpose:** Evaluate the specific tactics agent used to recover the sale.

### A. SWEETENER HOOK (Offers/Discounts)
- **Rating_Label**: HIGH / MEDIUM / LOW / NOT OFFERED
  - HIGH: Compelling, time-bound offer clearly communicated
  - MEDIUM: Generic offer mentioned
  - LOW: Weak/unclear offer
  - NOT OFFERED: No offer discussed
- **Details**: What specific offer/discount was mentioned?

### B. HOME MEASURE HOOK (Home Visit Service)
- **Offered**: true / false (Did agent offer home measurement/demo visit?)
- **Reasoning**: Why was this service offered? (Size uncertainty / Comfort trial / Family demonstration / Delivery consultation / Other)

### C. OTHER HOOKS (Optional - if applicable)
- Video Call Demo Offered
- Store Re-Visit Incentive
- Product Upgrade Suggestion
- EMI/Financing Option

---

## PILLAR 4: LEAD HEALTH (Where is the customer now?)
**Purpose:** Assess the customer's current position in the buying journey after this call.

Evaluate:
- **AIDA_Stage**: Where is the customer after this call?
  - Options: Awareness / Interest / Desire / Action / Lost

- **Next_Action_Text**: Specific, actionable next step with timeline
  - Example: "Coordinate with Technician for Home Measurement visit tomorrow"
  - Example: "Customer to visit store this weekend to finalize size"
  - Example: "Send WhatsApp link for online purchase by Friday"

---

## PILLAR 5: METHODOLOGY (RELAX Framework + Soft Skills)
**Purpose:** Evaluate agent's execution of Duroflex's structured sales methodology and interpersonal skills.

### A. RELAX SCORES

**R - REACH OUT** (Opening & Connection)
- **Score**: 1-5
- **Reason**: Short explanation
  - Did agent professionally greet, identify brand, and establish the store visit context?

**E - EXPLORE NEEDS** (Discovery & Understanding)
- **Score**: 1-5
- **Reason**: Short explanation
  - Did agent probe to find the REAL reason for not purchasing during store visit?

**L - LINK EXPERIENCE** (Connecting Solution to Need)
- **Score**: 1-5
- **Reason**: Short explanation
  - Did agent remind customer of their positive in-store experience and link product benefits to their concerns?

**A - ADD VALUE** (Enhancing the Proposition)
- **Score**: 1-5
- **Reason**: Short explanation
  - Did agent position offers, services (home measure, EMI, accessories) as value additions?

**X - EXPRESS CLOSING** (Commitment & Next Steps)
- **Score**: 1-5
- **Reason**: Short explanation
  - Did agent close with a clear, specific commitment and action plan?

### B. SOFT SKILLS (1-5 for each)
- **Empathy**: Understanding and acknowledging customer's concerns
- **Patience**: Not rushing, allowing customer to express themselves
- **Persuasion**: Convincing without being pushy
- **Tone**: Professional, warm, confident delivery

---

## SUMMARY
**Purpose:** Provide a concise, actionable overview of the call.

- **Call_Synopsis**: 2-3 sentences covering the customer's store visit reason, main barrier discussed, and the outcome of this call.

- **Recovery_Verdict**: What is the likelihood of this lead converting?
  - Options: Hot Lead / Warm Lead / Cold Lead / Lost / In-Progress

---

## OUTPUT FORMAT
Return ONLY a valid JSON object matching this exact schema:

{{
  "Header_Data": {{
    "Call_ID": "{call_record.get('call_id', 'N/A')}",
    "Product_of_Interest": "String (mention specific product if discussed, else 'Not Specified')",
    "Lead_Status_Label": "Hot Lead | Warm Lead | Cold Lead | Lost | In-Progress"
  }},
  "Pillar_1_Double_Audit": {{
    "Store_Audit": {{
      "Rating": 0,
      "Sentiment_Label": "Excellent | Positive | Neutral | Negative | Not Discussed",
      "Specific_Feedback": "String (What customer said about store experience)"
    }},
    "Call_Audit": {{
      "Rating": 0,
      "Sentiment_Label": "Excellent | Positive | Neutral | Negative | Frustrated",
      "Skill_Highlight": "String (Primary skill agent demonstrated)"
    }}
  }},
  "Pillar_2_Diagnosis": {{
    "Primary_WalkOut_Reason": "String",
    "Primary_Barrier_Icon": "Price | Product | Family | Timing | Trust | Other",
    "Decision_Maker": "Self | Spouse | Joint | Family | Other",
    "Timeline_Label": "Immediate | Short Term | Long Term | Uncertain | Not Purchasing"
  }},
  "Pillar_3_Recovery_Hooks": {{
    "Sweetener_Hook": {{
      "Rating_Label": "HIGH | MEDIUM | LOW | NOT OFFERED",
      "Details": "String (Specific offer mentioned)"
    }},
    "Home_Measure_Hook": {{
      "Offered": true/false,
      "Reasoning": "String (Why this service was relevant)"
    }}
  }},
  "Pillar_4_Lead_Health": {{
    "AIDA_Stage": "Awareness | Interest | Desire | Action | Lost",
    "Next_Action_Text": "String (Specific next step with timeline)"
  }},
  "Pillar_5_Methodology": {{
    "RELAX_Scores": {{
      "R": {{"Score": 0, "Reason": "String"}},
      "E": {{"Score": 0, "Reason": "String"}},
      "L": {{"Score": 0, "Reason": "String"}},
      "A": {{"Score": 0, "Reason": "String"}},
      "X": {{"Score": 0, "Reason": "String"}}
    }},
    "Soft_Skills": {{
      "Empathy": 0,
      "Patience": 0,
      "Persuasion": 0,
      "Tone": 0
    }}
  }},
  "Summary": {{
    "Call_Synopsis": "String (2-3 sentences)",
    "Recovery_Verdict": "Hot Lead | Warm Lead | Cold Lead | Lost | In-Progress"
  }},
  "Transcript_Log": [
    {{"Speaker": "Agent/Customer", "Text": "...", "Timestamp": "00:00"}}
  ]
}}

**Important Notes:**
1. All scores must be integers 1-5 (use 0 only if call didn't connect)
2. For calls that don't connect properly, use neutral/low ratings and explain in Synopsis
3. Transcribe the conversation as accurately as possible in Transcript_Log
4. Remember: This customer has ALREADY tried the product in-store — leverage this context
5. Return ONLY the JSON object, no additional text before or after
"""

    def _add_error(self, row_num: int, store_name: str, error: str):
        """Add error to job status"""
        self.job_status["errors"].append({
            "row": row_num,
            "store": store_name,
            "error": error
        })
        self.job_status["failed"] += 1

    def get_processed_calls(self) -> List[Dict]:
        """Get all successfully processed pre-purchase calls"""
        return self.processed_calls

    def get_discarded_calls(self) -> List[Dict]:
        """Get all post-purchase discarded calls"""
        return self.discarded_calls

    def get_job_status(self, job_id: str = None) -> Dict:
        """Get current job status"""
        if job_id and job_id != self.job_id:
            return {}
        return self.job_status
