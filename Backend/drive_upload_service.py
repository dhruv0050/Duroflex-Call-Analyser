"""
Google Drive Upload Service (Pure Python)
Handles OAuth token refresh and file uploads to Drive
"""
import os
import requests
import tempfile
from typing import Optional, Dict
from pathlib import Path

DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3'
UPLOAD_API_BASE = 'https://www.googleapis.com/upload/drive/v3'


def get_access_token() -> str:
    """Get a fresh access token using refresh token"""
    try:
        response = requests.post('https://oauth2.googleapis.com/token', data={
            'client_id': os.getenv('CLIENT_ID'),
            'client_secret': os.getenv('CLIENT_SECRET'),
            'refresh_token': os.getenv('REFRESH_TOKEN'),
            'grant_type': 'refresh_token'
        }, timeout=30)
        
        response.raise_for_status()
        return response.json()['access_token']
    except Exception as e:
        print(f"[DRIVE] Failed to refresh access token: {e}")
        raise Exception('Drive authentication failed')


def upload_file_to_drive(file_url: str, file_name: str, folder_id: str) -> Optional[Dict]:
    """
    Upload a file from URL to Google Drive
    
    Args:
        file_url: S3 presigned URL
        file_name: Name for the file on Drive
        folder_id: Target Google Drive folder ID
    
    Returns:
        Dict with fileId and webViewLink, or None on failure
    """
    temp_path = None
    try:
        # Get access token
        access_token = get_access_token()
        
        # Download file from S3
        print(f"[DRIVE] Downloading: {file_name}")
        response = requests.get(file_url, stream=True, timeout=300)
        
        # Check for expired/forbidden URLs
        if response.status_code == 403:
            print(f"[DRIVE] S3 URL expired or forbidden for {file_name}")
            raise Exception("S3 URL expired - presigned URL no longer valid")
        
        response.raise_for_status()
        
        # Save to temp file
        with tempfile.NamedTemporaryFile(mode='wb', delete=False, suffix=Path(file_name).suffix) as tmp:
            for chunk in response.iter_content(chunk_size=8192):
                tmp.write(chunk)
            temp_path = tmp.name
        
        # Detect MIME type
        ext = Path(file_name).suffix.lower()
        mime_map = {
            '.mp4': 'video/mp4',
            '.mov': 'video/quicktime',
            '.avi': 'video/x-msvideo',
            '.wav': 'audio/wav',
            '.mp3': 'audio/mpeg',
            '.m4a': 'audio/mp4'
        }
        mime_type = mime_map.get(ext, 'application/octet-stream')
        
        # Upload to Drive (resumable upload)
        print(f"[DRIVE] Uploading to folder: {folder_id}")
        
        # Step 1: Initiate resumable upload
        metadata = {
            'name': file_name,
            'parents': [folder_id]
        }
        
        init_response = requests.post(
            f'{UPLOAD_API_BASE}/files?uploadType=resumable',
            headers={
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json; charset=UTF-8'
            },
            json=metadata,
            timeout=30
        )
        init_response.raise_for_status()
        
        upload_url = init_response.headers['Location']
        
        # Step 2: Upload file content
        with open(temp_path, 'rb') as f:
            file_size = os.path.getsize(temp_path)
            upload_response = requests.put(
                upload_url,
                headers={
                    'Content-Type': mime_type,
                    'Content-Length': str(file_size)
                },
                data=f,
                timeout=300
            )
            upload_response.raise_for_status()
        
        file_id = upload_response.json()['id']
        
        # Step 3: Set permissions (anyone with link can view)
        if os.getenv('DRIVE_FILE_PERMISSION') == 'anyone':
            requests.post(
                f'{DRIVE_API_BASE}/files/{file_id}/permissions',
                headers={'Authorization': f'Bearer {access_token}'},
                json={'role': 'reader', 'type': 'anyone'},
                timeout=30
            )
        
        # Step 4: Get file metadata with links
        meta_response = requests.get(
            f'{DRIVE_API_BASE}/files/{file_id}?fields=id,webViewLink,webContentLink',
            headers={'Authorization': f'Bearer {access_token}'},
            timeout=30
        )
        meta_response.raise_for_status()
        
        result = meta_response.json()
        print(f"[DRIVE] Upload successful: {file_id}")
        
        return {
            'fileId': result['id'],
            'webViewLink': result.get('webViewLink'),
            'webContentLink': result.get('webContentLink')
        }
        
    except Exception as e:
        print(f"[DRIVE] Upload failed for {file_name}: {str(e)}")
        return None
    
    finally:
        # Cleanup temp file
        if temp_path and os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
            except:
                pass
