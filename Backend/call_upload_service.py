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
