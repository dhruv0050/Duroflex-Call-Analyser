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
          "audio_url": audio_url,
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
        cart_value = row.get('Lineitem price', 'Unknown')
        abandonment_date = row.get('LeadCreatedDate', 'Unknown')
        call_date = row.get('CallStartDateTime', 'Unknown')
        phone = row.get('Billing Phone', 'Unknown')
        city = row.get('Billing City', 'Unknown')
        zip_code = row.get('Billing Zip', 'Unknown')
        duration = row.get('Duration', 'Unknown') # Might be missing

        template = f"""
You are an expert Retail Operations & Sales Analyst for Duroflex.
... (Prompt Content) ...

## CALL & CART CONTEXT
- Customer_Name: Not Specified
- Cart_Products: Not Specified (General Cart Recovery)
- Cart_Value: {cart_value}
- Abandonment_Date: {abandonment_date}
- Days_Since_Abandonment: Unknown
- Abandonment_Stage: Unknown
- Store_Name (Nearest): Not Specified
- Location: {city}, {zip_code}
- Region: Unknown
- Call_Date: {call_date}
- Call_Duration: {duration} seconds

... (Rest of User Prompt) ...
"""
        # Append the full prompt text provided by user
        # I will inject the full detailed prompt here.
        
        full_prompt = f"""
You are an expert Retail Operations & Sales Analyst for Duroflex, a premium mattress and sleep solutions brand.

## CONTEXT
You are analyzing an Outbound Call made by a Duroflex Sales Agent to a customer who abandoned their online checkout. These calls are part of the Cart Recovery program where agents proactively reach out to understand barriers and nudge customers toward successful purchase completion. Your analysis must deeply evaluate the agent's ability to recover the sale while delivering an excellent customer experience.

## OBJECTIVE
Analyze this call through FIVE critical lenses:
1. **CUSTOMER INTENT & BARRIERS** — What is the customer's true purchase intent and what's blocking them?
2. **EXPERIENCE DELIVERED** — What experience did we deliver from both customer and sales perspectives?
3. **RELAX FRAMEWORK** — How well did the agent execute the Duroflex sales methodology?
4. **INVITATION TO CONVERT** — Did we provide clear, compelling paths to purchase?
5. **AGENT COMPETENCY** — Product knowledge, sales acumen, and interpersonal skills

## CALL & CART CONTEXT
- Customer_Name: Not Specified
- Cart_Products: Not Specified
- Cart_Value: {cart_value}
- Abandonment_Date: {abandonment_date}
- Days_Since_Abandonment: Unknown
- Abandonment_Stage: Unknown
- Store_Name (Nearest): Not Specified
- Location: {city}, {zip_code}
- Region: Unknown
- Call_Date: {call_date}
- Call_Duration: {duration} seconds

## RATING SCALE (Use for all scores)
- 1: Poor / Not Attempted
- 2: Below Average
- 3: Average / Met Minimum Standard
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

- **Primary_Abandonment_Reason**: Why did they leave checkout?
  - Price Concern / Delivery Issues / Product Doubt / Payment Failure / Comparing Options / Just Browsing / Technical Issue / Personal/Financial Reasons / Already Purchased Elsewhere / Not Disclosed

- **Secondary_Barriers**: Other concerns surfaced during call

- **Barrier_Resolution_Status**: Resolved / Partially Resolved / Unresolved / Not Attempted

- **Timeline_to_Purchase**: Immediate (Today/This Week) / Short (2-4 Weeks) / Long (>1 Month) / Uncertain / Not Purchasing

- **Customer_Stage_AIDA**: Where are they post-call?
  - Awareness / Interest / Desire / Action

- **Intent_Shift**: Did the call improve their purchase intent?
  - Increased / Unchanged / Decreased

---

## PILLAR 2: EXPERIENCE DELIVERED
**Purpose:** Evaluate the call from two perspectives — how the customer experienced it, and how effective it was as a sales interaction. This dual lens helps the Sales Head understand both brand impact and commercial effectiveness.

### A. CUSTOMER EXPERIENCE (Customer's Perspective)
*Did we make the customer feel valued and respected?*

- **Opening_Experience**: How did the call begin for the customer?
  - Was introduction clear and professional?
  - Was permission sought before proceeding?
  - Did customer feel respected, not ambushed?

- **Listening_Quality**: Did agent genuinely listen to concerns?
  - Active listening demonstrated
  - Customer felt understood
  - Concerns acknowledged before solutioning

- **Empathy_Displayed**: Did agent show understanding of customer's situation?
  - Acknowledged frustrations/concerns
  - Didn't dismiss objections
  - Personalized the conversation

- **Pressure_Level**: Was the call consultative or pushy?
  - Consultative: Customer-led, helpful
  - Balanced: Some urgency but respectful
  - Pushy: Aggressive, made customer uncomfortable

- **Closing_Sentiment**: How did customer feel at end of call?
  - Positive / Neutral / Negative

- **Customer_Experience_Rating**: HIGH / MEDIUM / LOW
  - HIGH: Customer felt heard, valued, and appreciated the call
  - MEDIUM: Neutral/transactional experience, no negative impact
  - LOW: Customer felt annoyed, rushed, or poorly treated

### B. SALES EXPERIENCE (Business Perspective)
*Was this a well-executed sales interaction that maximized the recovery opportunity?*

- **Opportunity_Utilization**: Did agent fully leverage the cart context and customer data?
  - Referenced specific products in cart
  - Used cart value to tailor approach
  - Acknowledged abandonment stage appropriately

- **Conversation_Control**: Did agent guide the conversation purposefully?
  - Maintained direction toward conversion goal
  - Balanced customer concerns with sales progression
  - Avoided aimless or circular discussion

- **Objection_Conversion**: Were objections turned into opportunities?
  - Reframed concerns as reasons to buy
  - Used objections to introduce value-adds
  - Didn't leave objections hanging

- **Value_Articulation**: Did agent communicate compelling reasons to buy now?
  - Differentiated Duroflex from alternatives
  - Justified price with value/benefits
  - Created relevance for customer's specific situation

- **Time_Efficiency**: Was the call duration productive?
  - Appropriate length for outcome achieved
  - No unnecessary tangents
  - Efficient yet not rushed

- **Commercial_Outcome_Alignment**: Did the call progress toward a business outcome?
  - Clear ask made
  - Next step defined
  - Pipeline value protected or advanced

- **Sales_Experience_Rating**: HIGH / MEDIUM / LOW
  - HIGH: Textbook sales call — controlled, persuasive, outcome-oriented
  - MEDIUM: Decent attempt but missed opportunities or lacked structure
  - LOW: Poorly executed — lost control, missed cues, no clear commercial direction

### C. OVERALL EXPERIENCE RATING
- **Overall_Experience_Rating**: 1-5
  - Weighted combination of Customer Experience and Sales Experience
  - 5: Exceptional on both dimensions — customer delighted AND sales excellence demonstrated
  - 4: Strong on both, minor gaps in one area
  - 3: Adequate — met basic standards but not memorable or highly effective
  - 2: Weak on one or both dimensions — clear improvement needed
  - 1: Poor — negative customer experience OR completely ineffective sales interaction

- **Overall_Experience_Summary**: 1-2 sentence summary explaining the rating

---

## PILLAR 3: RELAX FRAMEWORK EXECUTION
**Purpose:** Evaluate agent's adherence to Duroflex's structured sales methodology.

**R - REACH OUT** (Opening & Connection)
- Professional greeting with brand identification
- Clear introduction of self and purpose
- Permission to continue conversation
- Warm, confident tone from start

**E - EXPLORE NEEDS** (Discovery & Understanding)
- Asked about abandonment reason
- Probed deeper into underlying concerns
- Understood customer's specific requirements
- Identified decision-making factors (price, timeline, features)

**L - LINK EXPERIENCE** (Connecting Solution to Need)
- Connected product benefits to stated concerns
- Positioned store visit/trial as solution to doubts
- Made the experience tangible and relevant
- Addressed "why Duroflex" for their specific need

**A - ADD VALUE** (Enhancing the Proposition)
- Mentioned relevant offers/discounts
- Presented financing/EMI options
- Suggested complementary products/accessories
- Created perception of added value beyond base purchase

**X - EXPRESS CLOSING** (Commitment & Next Steps)
- Asked for commitment/next step
- Provided clear action path
- Confirmed logistics (timing, location, contact)
- Left door open for follow-up if not converting now

Rate each element 1-5 with specific reasons.

---

## PILLAR 4: INVITATION TO CONVERT
**Purpose:** Did the agent provide clear, compelling path(s) to complete the purchase?

Evaluate:
- **Invitation_Attempted**: Yes / No

- **Conversion_Paths_Offered** (check all that apply):
  - Online Completion: Guided to complete checkout, offered assistance
  - Store Visit: Invited to nearest store for trial/purchase
  - Video Call/Demo: Offered virtual product demonstration
  - None Offered

- **Primary_Path_Pushed**: Which path did agent primarily recommend?

- **Path_Appropriateness**: Was the recommended path suitable for customer's situation?
  - Highly Appropriate / Somewhat Appropriate / Inappropriate / Not Assessed

- **Urgency_Creation**: Did agent create appropriate urgency?
  - Offer expiry, stock availability, delivery timelines
  - 1-5 rating

- **Clarity_of_Next_Steps**: Were next steps crystal clear?
  - 1-5 rating

- **Commitment_Obtained**: What did customer agree to?
  - Purchase Completed on Call
  - Store Visit Scheduled (Date/Time confirmed)
  - Video Demo Scheduled
  - Online Completion Promised
  - Call-Back Requested
  - Will Think About It
  - Declined / Not Interested
  - None

- **Invitation_Quality_Rating**: 1-5 overall

---

## PILLAR 5: AGENT COMPETENCY
**Purpose:** Evaluate the agent's skills across three dimensions.

### A. PRODUCT KNOWLEDGE
- **Product_Understanding**: Did agent know the products in cart?
- **Feature_Articulation**: Could they explain benefits clearly?
- **Comparison_Ability**: Could they differentiate from alternatives?
- **Policy_Knowledge**: Delivery, returns, warranty, EMI options
- **Product_Knowledge_Score**: 1-5

### B. SALES SKILLS
- **Objection_Handling**: How well did they address concerns?
- **Value_Selling**: Did they sell value, not just features?
- **Negotiation_Ability**: Appropriate use of offers/discounts
- **Closing_Technique**: Ability to ask for commitment
- **Recovery_Tactics**: Specific cart recovery techniques used
- **Sales_Skills_Score**: 1-5

### C. SOFT SKILLS & ETIQUETTE
- **Tone_Quality**: Warm, professional, confident
- **Patience_Level**: Didn't rush, allowed customer to speak
- **Language_Fluency**: Clear communication in customer's language
- **Hold_Management**: Professional if holds were needed
- **Adaptability**: Adjusted approach based on customer responses
- **Soft_Skills_Score**: 1-5

---

## FUNCTIONAL INFORMATION (Supporting Data)
- Call_ID: Format "ABC_{call_date}_{{timestamp}}"
- Call_Time: From audio or "Not mentioned"
- Customer_Name: Confirmed name
- Agent_Name: If mentioned
- Store_Location: {city}
- Customer_Language: Primary language (English/Hindi/Kannada/Telugu/Tamil/Mix)
- Agent_Audio_Quality_Rating: 1-5
- Call_Outcome: Connected-Converted / Connected-Follow-Up Scheduled / Connected-Not Interested / Connected-Already Purchased / Not Connected-Voicemail / Not Connected-No Answer / Not Connected-Wrong Number

---

## OVERALL SUMMARY
- **Call_Synopsis**: 2-3 sentences covering abandonment reason, agent approach, and outcome
- **What_Worked_Well**: Top 2-3 things agent did effectively
- **Critical_Improvement_Areas**: Top 3 specific, actionable improvements
- **Recovery_Verdict**: Did this call move customer closer to purchase? (Yes-Significantly / Yes-Slightly / No Change / Negative Impact)
- **Next_Action**: Specific follow-up with timeline

---

## OUTPUT FORMAT
Return ONLY a valid JSON object matching this exact schema.
Do not include any text before or after the JSON:

{{
  "Functional": {{
    "Call_ID": "",
    "Call_Time": "",
    "Customer_Name": "",
    "Agent_Name": "",
    "Store_Location": "",
    "Customer_Language": "",
    "Agent_Audio_Quality_Rating": 0,
    "Call_Outcome": ""
  }},
  "Pillar_1_Customer_Intent_and_Barriers": {{
    "Intent_to_Purchase_Rating": "",
    "Intent_to_Purchase_Reasons": [],
    "Primary_Abandonment_Reason": "",
    "Secondary_Barriers": [],
    "Barrier_Resolution_Status": "",
    "Timeline_to_Purchase": "",
    "Customer_Stage_AIDA": "",
    "Intent_Shift": ""
  }},
  "Pillar_2_Experience_Delivered": {{
    "Customer_Experience": {{
      "Opening_Experience_Rating": 0,
      "Opening_Experience_Reasons": [],
      "Listening_Quality_Rating": 0,
      "Listening_Quality_Reasons": [],
      "Empathy_Displayed_Rating": 0,
      "Empathy_Displayed_Reasons": [],
      "Pressure_Level": "",
      "Closing_Sentiment": "",
      "Customer_Experience_Rating": "",
      "Customer_Experience_Reasons": []
    }},
    "Sales_Experience": {{
      "Opportunity_Utilization_Rating": 0,
      "Opportunity_Utilization_Reasons": [],
      "Conversation_Control_Rating": 0,
      "Conversation_Control_Reasons": [],
      "Objection_Conversion_Rating": 0,
      "Objection_Conversion_Reasons": [],
      "Value_Articulation_Rating": 0,
      "Value_Articulation_Reasons": [],
      "Time_Efficiency_Rating": 0,
      "Time_Efficiency_Reasons": [],
      "Commercial_Outcome_Alignment_Rating": 0,
      "Commercial_Outcome_Alignment_Reasons": [],
      "Sales_Experience_Rating": "",
      "Sales_Experience_Reasons": []
    }},
    "Overall_Experience_Rating": 0,
    "Overall_Experience_Summary": ""
  }},
  "Pillar_3_RELAX_Framework": {{
    "R_Reach_Out": {{"Rating": 0, "Reasons": []}},
    "E_Explore_Needs": {{"Rating": 0, "Reasons": []}},
    "L_Link_Experience": {{"Rating": 0, "Reasons": []}},
    "A_Add_Value": {{"Rating": 0, "Reasons": []}},
    "X_Express_Closing": {{"Rating": 0, "Reasons": []}},
    "RELAX_Overall_Score": 0
  }},
  "Pillar_4_Invitation_to_Convert": {{
    "Invitation_Attempted": false,
    "Conversion_Paths_Offered": [],
    "Primary_Path_Pushed": "",
    "Path_Appropriateness": "",
    "Urgency_Creation_Rating": 0,
    "Urgency_Creation_Reasons": [],
    "Clarity_of_Next_Steps_Rating": 0,
    "Clarity_of_Next_Steps_Reasons": [],
    "Commitment_Obtained": "",
    "Invitation_Quality_Rating": 0,
    "Invitation_Quality_Reasons": []
  }},
  "Pillar_5_Agent_Competency": {{
    "Product_Knowledge": {{
      "Score": 0,
      "Reasons": []
    }},
    "Sales_Skills": {{
      "Score": 0,
      "Reasons": []
    }},
    "Soft_Skills": {{
      "Score": 0,
      "Reasons": []
    }}
  }},
  "Overall_Summary": {{
    "Call_Synopsis": "",
    "What_Worked_Well": [],
    "Critical_Improvement_Areas": [],
    "Recovery_Verdict": "",
    "Next_Action": ""
  }},
  "Transcript_Log": [
    {{"Speaker": "", "Text": "", "Timestamp": ""}}
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
