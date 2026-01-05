"""
Audio Call Processor Service
Handles downloading audio files and processing them through Gemini API
"""

import os
import json
import time
import tempfile
import requests
import google.generativeai as genai
from typing import Optional, Dict, Tuple, Any
from datetime import datetime


class AudioDownloader:
    """Downloads and validates audio files from URLs"""

    def __init__(self, timeout: int = 60):
        self.timeout = timeout

    def download(self, url: str) -> Tuple[Optional[bytes], Optional[str]]:
        """
        Download audio from URL.
        Returns: (audio_bytes, error_message)
        """
        try:
            if not url or not isinstance(url, str):
                return None, "Invalid URL provided"

            print(f"[AUDIO] Downloading: {url[:80]}...")
            response = requests.get(url, timeout=self.timeout, allow_redirects=True)
            response.raise_for_status()

            audio_data = response.content

            if len(audio_data) < 1000:
                return None, "Audio file too small (<1KB)"

            print(f"[AUDIO] Downloaded {len(audio_data):,} bytes")
            return audio_data, None

        except requests.exceptions.Timeout:
            return None, "Download timeout (60s exceeded)"
        except requests.exceptions.ConnectionError:
            return None, "Connection error - unable to reach URL"
        except requests.exceptions.HTTPError as e:
            return None, f"HTTP Error {e.response.status_code}"
        except Exception as e:
            return None, f"Download failed: {str(e)}"


class GeminiAudioAnalyzer:
    """Analyzes audio calls using Gemini API"""

    def __init__(self, api_key: str, model: str = "gemini-2.0-flash"):
        """
        Initialize Gemini analyzer
        
        Args:
            api_key: Gemini API key
            model: Model name (default: gemini-2.0-flash for best performance)
        """
        self.model_name = model
        self.api_key = api_key

        # Configure Gemini API
        genai.configure(api_key=api_key)

        # Configure model with JSON output
        generation_config = genai.GenerationConfig(
            temperature=0.1,
            top_p=0.95,
            max_output_tokens=8192,
            response_mime_type="application/json"
        )

        self.model = genai.GenerativeModel(
            model_name=model,
            generation_config=generation_config
        )

        print(f"[GEMINI] Initialized: {model}")

    def analyze(
        self,
        audio_data: bytes,
        row_data: Dict[str, Any],
        prompt_template: str
    ) -> Tuple[Optional[Dict], Optional[str]]:
        """
        Analyze audio call using Gemini.
        
        Args:
            audio_data: Raw audio bytes
            row_data: CSV row data (store name, city, date, etc.)
            prompt_template: Prompt template with {placeholders}
        
        Returns: (analysis_dict, error_message)
        """
        temp_path = None
        uploaded_file = None

        try:
            # 1. Save bytes to temporary file
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as temp_file:
                temp_file.write(audio_data)
                temp_path = temp_file.name

            print(f"[GEMINI] Uploading audio to Gemini storage...")

            # 2. Upload to Gemini File API
            uploaded_file = genai.upload_file(temp_path, mime_type="audio/mp3")

            # Wait for processing
            while uploaded_file.state.name == "PROCESSING":
                time.sleep(1)
                uploaded_file = genai.get_file(uploaded_file.name)

            if uploaded_file.state.name == "FAILED":
                return None, "Gemini file processing failed"

            # 3. Format prompt with row data
            prompt = prompt_template.format(
                store_name=row_data.get('Store Name', 'Unknown'),
                locality=row_data.get('Locality', 'Unknown'),
                city=row_data.get('City', 'Unknown'),
                state=row_data.get('State', 'Unknown'),
                region=row_data.get('Region', 'Unknown'),
                call_date=row_data.get('Date', 'Unknown'),
                duration=row_data.get('Duration', 'Unknown')
            )

            print(f"[GEMINI] Analyzing audio...")

            # 4. Send to Gemini with file reference
            response = self.model.generate_content([prompt, uploaded_file])

            if not response.text:
                return None, "Empty response from Gemini"

            # 5. Parse JSON response
            json_text = response.text.strip()

            # Remove markdown code blocks if present
            if json_text.startswith("```"):
                json_text = json_text.split("```")[1]
                if json_text.startswith("json"):
                    json_text = json_text[4:]
            json_text = json_text.strip()

            analysis = json.loads(json_text)
            print(f"[GEMINI] Analysis complete")
            return analysis, None

        except json.JSONDecodeError as e:
            # Return partial response with parse error
            return {"parse_error": str(e), "raw_response": response.text}, None
        except Exception as e:
            return None, f"Analysis error: {str(e)}"

        finally:
            # 6. Cleanup
            if temp_path and os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except:
                    pass

            if uploaded_file:
                try:
                    genai.delete_file(uploaded_file.name)
                except:
                    pass

    def analyze_with_retry(
        self,
        audio_data: bytes,
        row_data: Dict[str, Any],
        prompt_template: str,
        max_retries: int = 3,
        retry_delay: int = 5
    ) -> Tuple[Optional[Dict], Optional[str]]:
        """
        Analyze audio with automatic retry on failure.
        
        Args:
            audio_data: Raw audio bytes
            row_data: CSV row data
            prompt_template: Prompt template
            max_retries: Maximum retry attempts
            retry_delay: Delay between retries (seconds)
        
        Returns: (analysis_dict, error_message)
        """
        last_error = None

        for attempt in range(1, max_retries + 1):
            result, error = self.analyze(audio_data, row_data, prompt_template)

            if result is not None:
                return result, None

            last_error = error
            print(f"[GEMINI] Attempt {attempt}/{max_retries} failed: {error}")

            if attempt < max_retries:
                wait_time = retry_delay * attempt
                print(f"[GEMINI] Retrying in {wait_time}s...")
                time.sleep(wait_time)

        return None, f"All {max_retries} attempts failed: {last_error}"


class PromptTemplate:
    """Manages Gemini analysis prompt templates"""

    @staticmethod
    def get_audio_call_prompt() -> str:
        """
        Get the prompt template for audio call analysis.
        This matches the Jupyter notebook prompt exactly.
        """
        return '''
You are an expert Retail Operations & Sales Analyst for Duroflex, a premium mattress and sleep solutions brand.

## CONTEXT
You are analyzing a Google My Business (GMB) audio voice call between a potential customer and a Duroflex Store Manager. Unlike video calls, these interactions are purely auditory and often serve as a bridge to a physical store visit. Your analysis will be used to improve 'Call-to-Visit' conversion rates.

## OBJECTIVE
To evaluate the Store Manager's ability to handle inquiries professionally, identify strengths/weaknesses in sales technique, and determine if the agent effectively converts the phone inquiry into a Physical Store Visit.
Note: Some calls may be Service/Post-Sales related.

## STORE CONTEXT
- Store Name: {store_name}
- Location: {locality}, {city}, {state}
- Region: {region}
- Call Date: {call_date}
- Call Duration: {duration} seconds

## RATING SCALE (Use for all scores)
- 1: Poor / Not Attempted
- 2: Below Average
- 3: Average / Met Minimum Standard
- 4: Good / Effective
- 5: Excellent / Exemplary

## ANALYSIS REQUIREMENTS

### Functional Information
- Call_ID: Create using format "CALL_{{store}}_{{date}}_{{hash}}" where hash is first 6 chars of recording URL hash
- Call_Time: Extract from audio if mentioned, otherwise use "Not mentioned"
- Customer_Name: Name of the customer if mentioned
- Agent_Name: Name of the Store Manager/Staff if mentioned
- Store_Location: {locality}, {city}
- Customer_Language: Primary language spoken (English, Hindi, Kannada, Telugu, Tamil, Mix, etc.)
- Agent_Audio_Quality_Rating: 1-5 based on clarity
- Call_Objective_Theme: Main purpose (Stock Check, Price Inquiry, Location/Hours, Complaint/Service, General Product Info, Exchange/Return, Delivery Inquiry)

### Customer Information
- Interest_Category: Mattress, Sofa, Bed, Pillows, Accessories, Multiple, or Service
- Specific_Product_Inquiry: Specific model name or "General"
- Primary_Questions_Asked: List top 3-4 specific questions
- Timeline_to_Purchase: Short (Today/This Week), Medium (2-4 Weeks), Long (>1 Month)
- Customer_Stage_AIDA: Awareness/Interest/Desire/Action
- Intent_to_Visit_Rating: HIGH/MEDIUM/LOW with reasons
- Intent_to_Purchase_Rating: HIGH/MEDIUM/LOW with reasons
- Barriers_to_Conversion: Primary barrier if intent is Low/Medium
- Customer_Satisfaction_Score: 1-5 based on closing sentiment

### Agent Performance Areas
Evaluate these with scores (1-5) and 2-3 bullet point reasons:

**Verbal Product Knowledge:**
- Description_Quality: Did they use descriptive vocabulary to explain the 'feel'?
- Stock_Availability_Check: Did they check system/physical stock confidently?

**The Invitation to Visit:**
- Attempted: Yes/No
- Quality_Rating: Did they explicitly invite to store or share location?

**RELAX Framework:**
- R_Reach_Out: Greeting & Brand Name usage
- E_Explore_Needs: Discovery of user needs/pain points
- L_Link_Experience: Linking need to physical store trial
- A_Add_Value: Mentioning offers/financing/accessories
- X_Express_Closing: Next steps/Logistics

**Soft Skills & Etiquette:**
- Tone_and_Patience: Patience and welcoming tone
- Hold_Management: Professional handling of hold times
- Agent_Language_Fluency_Score: Clear communication in customer's preferred language

### Overall Summary
- Call_Synopsis: 2-3 sentence summary
- Agent_Performance_Summary: Overall assessment
- Next_Action: Specific next step defined
- Top_3_Improvement_Areas: Actionable improvement suggestions

## OUTPUT FORMAT
Return ONLY a valid JSON object matching this exact schema. Do not include any text before or after the JSON:

{{
  "Functional": {{
    "Call_ID": "",
    "Call_Time": "",
    "Customer_Name": "",
    "Agent_Name": "",
    "Store_Location": "",
    "Customer_Language": "",
    "Agent_Audio_Quality_Rating": 0,
    "Call_Objective_Theme": ""
  }},
  "Customer_Information": {{
    "Interest_Category": "",
    "Specific_Product_Inquiry": "",
    "Primary_Questions_Asked": [],
    "Timeline_to_Purchase": "",
    "Customer_Stage_AIDA": "",
    "Intent_to_Visit_Rating": "",
    "Intent_to_Visit_Rating_Reasons": [],
    "Intent_to_Purchase_Rating": "",
    "Intent_to_Purchase_Rating_Reasons": [],
    "Barriers_to_Conversion": "",
    "Customer_Satisfaction_Score": 0,
    "Customer_Satisfaction_Score_Reasons": []
  }},
  "Agent_Areas": {{
    "Verbal_Product_Knowledge": {{
      "Description_Quality_Rating": 0,
      "Description_Quality_Reason": "",
      "Stock_Availability_Check_Rating": 0,
      "Stock_Availability_Check_Reason": ""
    }},
    "The_Invitation_to_Visit": {{
      "Attempted": false,
      "Quality_Rating": 0,
      "Reasons": []
    }},
    "RELAX_Framework": {{
      "R_Reach_Out": {{"Rating": 0, "Reasons": []}},
      "E_Explore_Needs": {{"Rating": 0, "Reasons": []}},
      "L_Link_Experience": {{"Rating": 0, "Reasons": []}},
      "A_Add_Value": {{"Rating": 0, "Reasons": []}},
      "X_Express_Closing": {{"Rating": 0, "Reasons": []}}
    }},
    "SoftSkills_Etiquette": {{
      "Tone_and_Patience_Rating": 0,
      "Hold_Management_Rating": 0,
      "Agent_Language_Fluency_Score": 0,
      "Soft_Skills_Reasons": []
    }},
    "Top_3_Improvement_Areas": []
  }},
  "Overall_Summary": {{
    "Call_Synopsis": "",
    "Agent_Performance_Summary": "",
    "Next_Action": ""
  }},
  "Transcript_Log": [
    {{"Speaker": "", "Text": "", "Timestamp": ""}}
  ]
}}

IMPORTANT:
1. Return ONLY the JSON object, no markdown formatting, no code blocks
2. All scores must be integers 1-5
3. All arrays must have at least one element
4. "Attempted" must be boolean true/false
5. Transcribe the conversation as best as possible in Transcript_Log
'''


if __name__ == "__main__":
    print("Audio Processor Service Module")
    print("Import this module to use AudioDownloader, GeminiAudioAnalyzer, and PromptTemplate")
