"""
Call Upload Processing Service
Orchestrates CSV upload → Gemini analysis → Flattening → MongoDB storage
"""

import json
import uuid
import time
import pandas as pd
import math
from typing import Optional, Dict, List, Tuple, Any
from datetime import datetime
from audio_processor import AudioDownloader, GeminiAudioAnalyzer, PromptTemplate


def sanitize_nan(obj):
    """Recursively replace NaN values with None for JSON serialization."""
    if isinstance(obj, dict):
        return {k: sanitize_nan(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_nan(item) for item in obj]
    elif isinstance(obj, float) and math.isnan(obj):
        return None
    return obj


def _gmb_hml_to_1_5(value: Any, default: int = 3) -> int:
    """Convert High/Medium/Low or H/M/L to a 1-5 score."""
    if value is None:
        return default
    text = str(value).strip().upper()
    if text in {"H", "HIGH"}:
        return 5
    if text in {"M", "MED", "MEDIUM"}:
        return 3
    if text in {"L", "LOW"}:
        return 1
    return default


def _gmb_rating_to_upper_hml(value: Any, default: str = "MEDIUM") -> str:
    """Convert High/Medium/Low (any case) to HIGH/MEDIUM/LOW."""
    if value is None:
        return default
    text = str(value).strip().upper()
    if "HIGH" in text or text == "H":
        return "HIGH"
    if "LOW" in text or text == "L":
        return "LOW"
    if "MED" in text or text == "M":
        return "MEDIUM"
    return default


def normalize_gmb_analysis_v2_to_legacy(analysis_v2: Dict[str, Any], row_data: Dict[str, Any]) -> Dict[str, Any]:
    """Map the new GMB prompt schema into the legacy analysis keys used by the UI."""
    meta = analysis_v2.get("MetaData", {}) if isinstance(analysis_v2, dict) else {}
    call_obj = analysis_v2.get("1_Call_Objective", {}) if isinstance(analysis_v2, dict) else {}
    intent_purchase = analysis_v2.get("2_Intent_to_Purchase", {}) if isinstance(analysis_v2, dict) else {}
    cust_exp = analysis_v2.get("3_Customer_Experience", {}) if isinstance(analysis_v2, dict) else {}
    funnel = analysis_v2.get("4_Funnel_Analysis", {}) if isinstance(analysis_v2, dict) else {}
    product = analysis_v2.get("5_Product_Intelligence", {}) if isinstance(analysis_v2, dict) else {}
    needs = analysis_v2.get("6_Customer_Needs", {}) if isinstance(analysis_v2, dict) else {}
    invites = analysis_v2.get("9_Invitations", {}) if isinstance(analysis_v2, dict) else {}
    relax = analysis_v2.get("11_RELAX_Framework", {}) if isinstance(analysis_v2, dict) else {}
    agent_eval = analysis_v2.get("12_Agent_Evaluation", {}) if isinstance(analysis_v2, dict) else {}
    learnings = analysis_v2.get("13_Agent_Learnings", []) if isinstance(analysis_v2, dict) else []

    # Basic legacy mapping
    legacy: Dict[str, Any] = {
        "Functional": {
            "Call_ID": "",
            "Call_Time": "Not mentioned",
            "Customer_Name": meta.get("Customer_Name", ""),
            "Agent_Name": "",
            "Store_Location": f"{row_data.get('Locality', 'Unknown')}, {row_data.get('City', 'Unknown')}",
            "Customer_Language": meta.get("Customer_Language", ""),
            "Agent_Audio_Quality_Rating": _gmb_hml_to_1_5(meta.get("Call_Quality_Overall"), default=3),
            "Call_Objective_Theme": call_obj.get("Objective_Phrase", ""),
        },
        "Customer_Information": {
            "Interest_Category": product.get("Product_of_Interest", "") or "",
            "Specific_Product_Inquiry": product.get("Product_of_Interest", "") or "General",
            "Primary_Questions_Asked": [],
            "Timeline_to_Purchase": funnel.get("Timeline_to_Purchase", "Unknown"),
            "Customer_Stage_AIDA": funnel.get("Stage", "Awareness"),
            "Intent_to_Visit_Rating": _gmb_rating_to_upper_hml(invites.get("Store_Visit", {}).get("Rating")),
            "Intent_to_Visit_Rating_Reasons": [invites.get("Store_Visit", {}).get("Reason", "") or ""],
            "Intent_to_Purchase_Rating": _gmb_rating_to_upper_hml(intent_purchase.get("Rating")),
            "Intent_to_Purchase_Rating_Reasons": [intent_purchase.get("Reason", "") or ""],
            "Barriers_to_Conversion": analysis_v2.get("7_Purchase_Barrier", "") if isinstance(analysis_v2, dict) else "",
            "Customer_Satisfaction_Score": _gmb_hml_to_1_5(cust_exp.get("Rating"), default=3),
            "Customer_Satisfaction_Score_Reasons": [cust_exp.get("Reason", "") or ""],
        },
        "Agent_Areas": {
            "Verbal_Product_Knowledge": {
                "Description_Quality_Rating": 0,
                "Description_Quality_Reason": "",
                "Stock_Availability_Check_Rating": 0,
                "Stock_Availability_Check_Reason": "",
            },
            "The_Invitation_to_Visit": {
                "Attempted": bool(invites.get("Store_Visit", {}).get("Reason") or invites.get("Store_Visit", {}).get("Rating")),
                "Quality_Rating": _gmb_hml_to_1_5(invites.get("Store_Visit", {}).get("Rating"), default=3),
                "Reasons": [invites.get("Store_Visit", {}).get("Reason", "") or ""],
            },
            "RELAX_Framework": {
                "R_Reach_Out": {"Rating": _gmb_hml_to_1_5(relax.get("R_Reach_Out", {}).get("Score"), default=3), "Reasons": [relax.get("R_Reach_Out", {}).get("Reason", "") or ""]},
                "E_Explore_Needs": {"Rating": _gmb_hml_to_1_5(relax.get("E_Explore_Needs", {}).get("Score"), default=3), "Reasons": [relax.get("E_Explore_Needs", {}).get("Reason", "") or ""]},
                "L_Link_Experience": {"Rating": _gmb_hml_to_1_5(relax.get("L_Link_Product", {}).get("Score"), default=3), "Reasons": [relax.get("L_Link_Product", {}).get("Reason", "") or ""]},
                "A_Add_Value": {"Rating": _gmb_hml_to_1_5(relax.get("A_Add_Value", {}).get("Score"), default=3), "Reasons": [relax.get("A_Add_Value", {}).get("Reason", "") or ""]},
                "X_Express_Closing": {"Rating": _gmb_hml_to_1_5(relax.get("X_Express_Closing", {}).get("Score"), default=3), "Reasons": [relax.get("X_Express_Closing", {}).get("Reason", "") or ""]},
            },
            "SoftSkills_Etiquette": {
                "Tone_and_Patience_Rating": _gmb_hml_to_1_5(cust_exp.get("Rating"), default=3),
                "Hold_Management_Rating": 0,
                "Agent_Language_Fluency_Score": 0,
                "Soft_Skills_Reasons": [cust_exp.get("Reason", "") or ""],
            },
            "Top_3_Improvement_Areas": [x for x in learnings if isinstance(x, str) and x.strip()][:3],
        },
        "Overall_Summary": {
            "Call_Synopsis": analysis_v2.get("Call_Summary", "") if isinstance(analysis_v2, dict) else "",
            "Agent_Performance_Summary": "",
            "Next_Action": analysis_v2.get("14_Next_Actions", "") if isinstance(analysis_v2, dict) else "",
        },
        # Legacy UI expects list; keep transcript accessible without breaking.
        "Transcript_Log": [
            {
                "Speaker": "",
                "Text": analysis_v2.get("Transcript_Log", "") if isinstance(analysis_v2, dict) else "",
                "Timestamp": "",
            }
        ],
    }

    # Normalize funnel stage to AIDA-ish labels used elsewhere
    stage = str(legacy["Customer_Information"].get("Customer_Stage_AIDA", "Awareness") or "Awareness").strip().lower()
    if stage == "consideration":
        legacy["Customer_Information"]["Customer_Stage_AIDA"] = "Interest"
    elif stage == "action":
        legacy["Customer_Information"]["Customer_Stage_AIDA"] = "Action"
    else:
        legacy["Customer_Information"]["Customer_Stage_AIDA"] = "Awareness"

    # Normalize timeline strings to legacy buckets
    timeline = str(legacy["Customer_Information"].get("Timeline_to_Purchase", "Unknown") or "Unknown").strip().lower()
    if timeline == "immediate":
        legacy["Customer_Information"]["Timeline_to_Purchase"] = "Short"
    elif timeline == "short term":
        legacy["Customer_Information"]["Timeline_to_Purchase"] = "Medium"
    elif timeline == "long term":
        legacy["Customer_Information"]["Timeline_to_Purchase"] = "Long"
    else:
        legacy["Customer_Information"]["Timeline_to_Purchase"] = "Unknown"

    return legacy


class CSVValidator:
    """Validates CSV structure for audio call uploads"""

    REQUIRED_COLUMNS = [
        'Store Name',
        'Locality',
        'City',
        'State',
        'Region',
        'Recording URL',
        'Duration',
        'Date'
    ]

    @staticmethod
    def validate(df: pd.DataFrame) -> Tuple[bool, Optional[str]]:
        """
        Validate CSV has required columns.
        Returns: (is_valid, error_message)
        """
        missing = [col for col in CSVValidator.REQUIRED_COLUMNS if col not in df.columns]

        if missing:
            return False, f"Missing columns: {', '.join(missing)}"

        if len(df) == 0:
            return False, "CSV is empty"

        return True, None


class CallDataFlattener:
    """Flattens nested JSON analysis into flat structure"""

    @staticmethod
    def flatten_json(nested_json: Any, parent_key: str = '', sep: str = '_') -> Dict:
        """
        Recursively flatten nested JSON object.
        """
        items = []

        if isinstance(nested_json, dict):
            for key, value in nested_json.items():
                new_key = f"{parent_key}{sep}{key}" if parent_key else key

                # Skip Transcript_Log as it's large and not needed for storage
                if key == 'Transcript_Log':
                    items.append((f"{new_key}_count", len(value) if isinstance(value, list) else 0))
                    continue

                if isinstance(value, dict):
                    items.extend(CallDataFlattener.flatten_json(value, new_key, sep=sep).items())
                elif isinstance(value, list):
                    if len(value) > 0:
                        # For lists of strings (reasons, questions)
                        if all(isinstance(item, str) for item in value):
                            for idx, item in enumerate(value, 1):
                                items.append((f"{new_key}_{idx}", item))
                            items.append((f"{new_key}_count", len(value)))
                        else:
                            # For complex lists, convert to string
                            items.append((new_key, json.dumps(value)))
                    else:
                        items.append((new_key, None))
                else:
                    items.append((new_key, value))
        else:
            items.append((parent_key, nested_json))

        return dict(items)

    @staticmethod
    def flatten_call_analysis(analysis: Dict) -> Dict:
        """
        Flatten a call analysis structure.
        Returns: dict with flattened keys like 'Functional_Call_ID', etc.
        """
        if not isinstance(analysis, dict):
            return {}

        if 'error' in analysis:
            return {'analysis_error': analysis.get('error', '')}

        return CallDataFlattener.flatten_json(analysis)


class ProcessingJob:
    """Tracks the state of a CSV processing job"""

    def __init__(self, filename: str):
        self.job_id = str(uuid.uuid4())
        self.filename = filename
        self.status = "pending"  # pending → processing → completed/failed
        self.created_at = datetime.now()
        self.started_at = None
        self.completed_at = None
        self.total_records = 0
        self.processed = 0
        self.successful = 0
        self.failed = 0
        self.errors: List[Dict] = []

    def to_dict(self) -> Dict:
        """Convert to dictionary for MongoDB storage"""
        return {
            "job_id": self.job_id,
            "filename": self.filename,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "total_records": self.total_records,
            "processed": self.processed,
            "successful": self.successful,
            "failed": self.failed,
            "errors": self.errors
        }

    def add_error(self, row_num: int, store_name: str, error: str):
        """Log an error for a specific row"""
        self.errors.append({
            "row": row_num,
            "store": store_name,
            "error": error
        })
        self.failed += 1

    def mark_success(self):
        """Mark one record as successfully processed"""
        self.successful += 1
        self.processed += 1

    def mark_processing(self):
        """Mark job as started"""
        self.status = "processing"
        self.started_at = datetime.now()

    def mark_completed(self):
        """Mark job as completed"""
        self.status = "completed"
        self.completed_at = datetime.now()

    def mark_failed(self):
        """Mark job as failed"""
        self.status = "failed"
        self.completed_at = datetime.now()


class CallUploadProcessor:
    """Main orchestrator for CSV upload processing"""

    def __init__(self, api_key: str):
        """
        Initialize processor with Gemini API key.
        """
        self.api_key = api_key
        self.downloader = AudioDownloader(timeout=60)
        self.analyzer = GeminiAudioAnalyzer(api_key=api_key)
        self.prompt = PromptTemplate.get_audio_call_prompt()
        self.jobs: Dict[str, ProcessingJob] = {}
        self.processed_calls: List[Dict] = []

    def create_call_id(self, store_name: str, date: str, url: str) -> str:
        """Create unique call ID from store name, date, and URL hash"""
        import hashlib
        url_hash = hashlib.md5(url.encode()).hexdigest()[:6].upper()
        clean_store = store_name.replace(' ', '_')[:15]
        clean_date = date.replace('-', '')[:8]
        return f"CALL_{clean_store}_{clean_date}_{url_hash}"

    def process_single_call(
        self,
        row_num: int,
        row_data: Dict[str, Any],
        job: ProcessingJob
    ) -> Tuple[Optional[Dict], Optional[str]]:
        """
        Process a single call: download → analyze → flatten.
        Returns: (call_record, error_message)
        """
        try:
            store_name = row_data.get('Store Name', 'Unknown')
            url = row_data.get('Recording URL')

            if not url:
                job.add_error(row_num, store_name, "No recording URL")
                return None, "No recording URL"

            # 1. Download audio
            print(f"\n[UPLOAD] Row {row_num}: {store_name}")
            audio_data, download_error = self.downloader.download(url)

            if download_error:
                job.add_error(row_num, store_name, f"Download: {download_error}")
                return None, download_error

            # 2. Analyze with Gemini
            analysis, gemini_error = self.analyzer.analyze_with_retry(
                audio_data=audio_data,
                row_data=row_data,
                prompt_template=self.prompt,
                max_retries=3,
                retry_delay=5
            )

            if gemini_error:
                job.add_error(row_num, store_name, f"Analysis: {gemini_error}")
                return None, gemini_error

            analysis_v2 = None
            # If the new schema is returned, store it separately and keep a legacy-compatible view.
            if isinstance(analysis, dict) and ("MetaData" in analysis or "2_Intent_to_Purchase" in analysis):
                analysis_v2 = analysis
                analysis = normalize_gmb_analysis_v2_to_legacy(analysis_v2, row_data=row_data)

            # 3. Create call record with metadata
            call_id = self.create_call_id(store_name, row_data.get('Date', ''), url)

            call_record = {
                "call_id": call_id,
                "store_name": store_name,
                "locality": row_data.get('Locality', 'Unknown'),
                "city": row_data.get('City', 'Unknown'),
                "state": row_data.get('State', 'Unknown'),
                "region": row_data.get('Region', 'Unknown'),
                "call_date": row_data.get('Date', 'Unknown'),
                "duration_seconds": int(row_data.get('Duration', 0)),
                "recording_url": url,
                "analysis": analysis,
                **({"analysis_v2": analysis_v2} if analysis_v2 else {}),
                "flattened_data": CallDataFlattener.flatten_call_analysis(analysis),
                "upload_timestamp": datetime.now().isoformat(),
            }

            # Sanitize NaN values before returning
            call_record = sanitize_nan(call_record)

            print(f"[UPLOAD] ✅ Row {row_num} processed successfully")
            job.mark_success()
            return call_record, None

        except Exception as e:
            error_msg = f"Processing error: {str(e)}"
            job.add_error(row_num, row_data.get('Store Name', 'Unknown'), error_msg)
            return None, error_msg

    def process_csv_file(
        self,
        csv_file_path: str,
        rate_limit_delay: float = 2.0
    ) -> str:
        """
        Process entire CSV file.
        
        Args:
            csv_file_path: Path to uploaded CSV file
            rate_limit_delay: Seconds to wait between API calls (to avoid quota limits)
        
        Returns: job_id for tracking progress
        """
        job = ProcessingJob(filename=csv_file_path.split('/')[-1])
        self.jobs[job.job_id] = job

        try:
            # 1. Load CSV
            print(f"\n[UPLOAD] Loading CSV: {csv_file_path}")
            df = pd.read_csv(csv_file_path)

            # 2. Validate structure
            is_valid, error = CSVValidator.validate(df)
            if not is_valid:
                job.status = "failed"
                job.errors = [{"error": error}]
                return job.job_id

            job.total_records = len(df)
            job.mark_processing()
            print(f"[UPLOAD] Starting to process {len(df)} calls...")

            # 3. Process each row
            self.processed_calls = []

            for idx, row in df.iterrows():
                row_num = idx + 1
                row_data = row.to_dict()

                call_record, error = self.process_single_call(row_num, row_data, job)

                if call_record:
                    self.processed_calls.append(call_record)

                # Rate limiting to avoid Gemini API quota issues
                time.sleep(rate_limit_delay)

            job.mark_completed()
            print(f"\n[UPLOAD] ✅ Processing complete: {job.successful}/{job.total_records} successful")
            return job.job_id

        except Exception as e:
            job.mark_failed()
            job.errors = [{"error": str(e)}]
            print(f"[UPLOAD] ❌ Processing failed: {str(e)}")
            return job.job_id

    def get_job_status(self, job_id: str) -> Optional[Dict]:
        """Get status of a processing job"""
        job = self.jobs.get(job_id)
        return job.to_dict() if job else None

    def get_processed_calls(self) -> List[Dict]:
        """Get list of all processed calls from last job"""
        return self.processed_calls


if __name__ == "__main__":
    print("Call Upload Processing Service Module")
    print("Import this module to use CallUploadProcessor")
