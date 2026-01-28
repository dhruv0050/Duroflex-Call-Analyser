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
                    
                    # Create prompt template with context
                    prompt_template_str = self._create_prompt_template(base_record)
                    
                    # Analyze
                    analysis, analysis_error = self.analyzer_full.analyze(
                        audio_data=audio_data,
                        row_data={
                            "store_name": store_name,
                            "customer_phone": customer_phone,
                            "duration": duration
                        },
                        prompt_template=prompt_template_str
                    )
                    
                    if analysis is None:
                        self._add_error(row_num, store_name, analysis_error or "Analysis failed")
                        continue
                    
                    # Store successful record
                    base_record["analysis"] = analysis
                    self.processed_calls.append(base_record)
                    self.job_status["successful"] += 1
                    self.job_status["processed"] += 1
                    
                    print(f"[OUTBOUND] ✓ Row {row_num} processed successfully")
                    
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

## OBJECTIVE
Analyze this call through FIVE critical lenses:
1. **CUSTOMER INTENT & BARRIERS** — What is the customer's true purchase intent and what's blocking them?
2. **EXPERIENCE DELIVERED** — What experience did we deliver from both customer and sales perspectives?
3. **RELAX FRAMEWORK** — How well did the agent execute the Duroflex sales methodology?
4. **INVITATION TO CONVERT** — Did we provide clear, compelling paths to purchase?
5. **AGENT COMPETENCY** — Product knowledge, sales acumen, and interpersonal skills

## CALL & STORE VISIT CONTEXT
- Store_Name: {call_record.get('store_name', 'N/A')}
- Customer_Phone: {call_record.get('customer_phone', 'N/A')}
- Lead_Source: {call_record.get('lead_source', 'Store Walkin - Non Customer')}
- Created_Date: {call_record.get('created_date', 'N/A')}
- CallStartDateTime: {call_record.get('call_date', 'N/A')}
- Duration_Seconds: {call_record.get('duration', 'N/A')}
- is_Converted: {call_record.get('is_converted', '0')}
- 4: Good / Effective
- 5: Excellent / Exemplary

---

## PILLAR 1: CUSTOMER INTENT & PURCHASE BARRIERS
**Purpose:** Understand where the customer truly stands in their buying journey and what obstacles exist.

Evaluate:
- **Intent_to_Purchase_Rating**: HIGH / MEDIUM / LOW
  - HIGH: Ready to buy, just needed nudge/resolution
  - MEDIUM: Interested but has unresolved concerns
  - LOW: Not planning to purchase / was just browsing / already bought elsewhere

- **Primary_NonPurchase_Reason**: Why didn't they buy during store visit?
  - Price Concern / Need Family/Spouse Consultation / Comparing Options / Not Ready to Decide / Size/Space Concerns / Delivery/Installation Timing / Budget Constraints / Just Browsing / Wanted Better Offer / Already Purchased Elsewhere / Not Disclosed

- **Secondary_Barriers**: Other concerns surfaced during call

- **Barrier_Resolution_Status**: Resolved / Partially Resolved / Unresolved / Not Attempted

- **Timeline_to_Purchase**: Immediate (Today/This Week) / Short (2-4 Weeks) / Long (>1 Month) / Uncertain / Not Purchasing

- **Customer_Stage_AIDA**: Where are they post-call?
  - Awareness / Interest / Desire / Action

- **Intent_Shift**: Did the call improve their purchase intent?
  - Increased / Unchanged / Decreased

---

## PILLAR 2: EXPERIENCE DELIVERED
**Purpose:** Evaluate the call from two perspectives — how the customer experienced it, and how effective it was as a sales interaction.

### A. CUSTOMER EXPERIENCE (Customer's Perspective)
- **Opening_Experience**: How did the call begin for the customer?
- **Listening_Quality**: Did agent genuinely listen to concerns?
- **Empathy_Displayed**: Did agent show understanding of customer's situation?
- **Pressure_Level**: Was the call consultative or pushy? (Consultative / Balanced / Pushy)
- **Closing_Sentiment**: How did customer feel at end of call? (Positive / Neutral / Negative)
- **Customer_Experience_Rating**: HIGH / MEDIUM / LOW

### B. SALES EXPERIENCE (Business Perspective)
- **Opportunity_Utilization**: Did agent leverage store visit context and customer data?
- **Conversation_Control**: Did agent guide conversation purposefully?
- **Objection_Conversion**: Were objections turned into opportunities?
- **Value_Articulation**: Did agent communicate compelling reasons to buy?
- **Time_Efficiency**: Was the call duration productive?
- **Commercial_Outcome_Alignment**: Did the call progress toward a business outcome?
- **Sales_Experience_Rating**: HIGH / MEDIUM / LOW

### C. OVERALL EXPERIENCE RATING
- **Overall_Experience_Rating**: 1-5 (Weighted combination of Customer and Sales Experience)
- **Overall_Experience_Summary**: 1-2 sentence summary explaining the rating

---

## PILLAR 3: RELAX FRAMEWORK EXECUTION
**Purpose:** Evaluate agent's adherence to Duroflex's structured sales methodology.

**R - REACH OUT** (Opening & Connection)
- Professional greeting with brand identification
- Clear introduction of self and purpose
- Permission to continue conversation

**E - EXPLORE NEEDS** (Discovery & Understanding)
- Asked about reason for not purchasing during visit
- Probed deeper into underlying concerns
- Understood customer's specific requirements

**L - LINK EXPERIENCE** (Connecting Solution to Need)
- Reinforced positive in-store experience
- Connected product benefits to stated concerns
- Addressed any gaps from visit

**A - ADD VALUE** (Enhancing the Proposition)
- Mentioned relevant offers/discounts
- Presented financing/EMI options
- Suggested complementary products

**X - EXPRESS CLOSING** (Commitment & Next Steps)
- Asked for commitment/next step
- Provided clear action path
- Confirmed logistics

Rate each element 1-5 with specific reasons.

---

## PILLAR 4: INVITATION TO CONVERT
**Purpose:** Did the agent provide clear, compelling path(s) to complete the purchase?

Evaluate:
- **Invitation_Attempted**: Yes / No
- **Conversion_Paths_Offered**: (Store Re-Visit / Purchase on Call / Home Visit/Demo / Online Purchase / Video Call/Demo)
- **Primary_Path_Pushed**: Which path did agent primarily recommend?
- **Path_Appropriateness**: Highly Appropriate / Somewhat Appropriate / Inappropriate / Not Assessed
- **Urgency_Creation_Rating**: 1-5 (offer expiry, stock availability, delivery timelines)
- **Clarity_of_Next_Steps_Rating**: 1-5
- **Commitment_Obtained**: (Purchase Completed / Store Visit Scheduled / Home Visit Scheduled / Video Demo Scheduled / Online Purchase Promised / Call-Back Requested / Will Think About It / Declined / None)
- **Invitation_Quality_Rating**: 1-5

---

## PILLAR 5: AGENT COMPETENCY
**Purpose:** Evaluate the agent's skills across three dimensions.

### A. PRODUCT KNOWLEDGE (1-5)
- Did agent know the products customer tried?
- Could they explain benefits clearly?
- Could they differentiate from alternatives?
- Policy knowledge (delivery, returns, warranty, EMI)

### B. SALES SKILLS (1-5)
- Objection handling
- Value selling (not just features)
- Negotiation ability (offers/discounts)
- Closing technique
- Recovery tactics for store walkin

### C. SOFT SKILLS & ETIQUETTE (1-5)
- Tone quality (warm, professional, confident)
- Patience level (didn't rush)
- Language fluency
- Adaptability

---

## FUNCTIONAL INFORMATION (Supporting Data)
- Call_ID: {call_record.get('call_id', 'N/A')}
- Call_Time: From audio or "Not mentioned"
- Customer_Phone: {call_record.get('customer_phone', 'N/A')}
- Agent_Name: If mentioned
- Store_Name: {call_record.get('store_name', 'N/A')}
- Customer_Language: Primary language (English/Hindi/Kannada/Telugu/Tamil/Mix)
- Agent_Audio_Quality_Rating: 1-5
- Call_Outcome: (Connected-Converted / Connected-Follow-Up Scheduled / Connected-Not Interested / Connected-Already Purchased / Not Connected-Voicemail / Not Connected-No Answer / Not Connected-Wrong Number)

---

## OVERALL SUMMARY
- **Call_Synopsis**: 2-3 sentences covering non-purchase reason from store visit, agent approach, and outcome
- **What_Worked_Well**: Top 2-3 things agent did effectively
- **Critical_Improvement_Areas**: Top 3 specific, actionable improvements
- **Recovery_Verdict**: Did this call move customer closer to purchase? (Yes-Significantly / Yes-Slightly / No Change / Negative Impact)
- **Next_Action**: Specific follow-up with timeline

---

## OUTPUT FORMAT
Return ONLY a valid JSON object. Do not include any text before or after the JSON.

Important:
1. All scores must be integers 1-5
2. All arrays must have at least one element
3. "Invitation_Attempted" must be boolean true/false
4. For calls that don't connect, use 0 for scores and "N/A - Call Not Connected" for reason fields
5. Transcribe the conversation as best as possible in Transcript_Log
6. Remember: This customer has ALREADY tried the product in-store — leverage this context in your analysis
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
