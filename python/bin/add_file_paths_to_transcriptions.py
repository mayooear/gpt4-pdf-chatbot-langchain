"""
Migration script to add file_path field to transcription JSON files.

This script reads file path information from the SQLite database and adds it to the corresponding
transcription JSON files. It ensures each transcription file has a reference to its original media file.
"""

import sqlite3
import gzip
import json
from pathlib import Path

# Database and transcription file locations relative to script location
TRANSCRIPTIONS_DB_PATH = Path(__file__).parent.parent / "data_ingestion" / "media" / "transcriptions.db"
TRANSCRIPTIONS_DIR = Path(__file__).parent.parent / "data_ingestion" / "media" / "transcriptions"

def migrate_json_files():
    """
    Updates all transcription JSON files to include their corresponding file_path.
    
    Reads file mappings from SQLite DB and adds the file_path field to each JSON file
    if not already present. Skips files that already have the field or are missing.
    """
    # Connect to SQLite DB
    conn = sqlite3.connect(TRANSCRIPTIONS_DB_PATH)
    c = conn.cursor()
    
    # Get all file mappings from transcriptions table
    c.execute("SELECT file_path, json_file FROM transcriptions")
    records = c.fetchall()
    
    for (file_path, json_file) in records:            
        json_path = TRANSCRIPTIONS_DIR / json_file
        if not json_path.exists():
            print(f"Skipping missing file: {json_path}")
            continue
            
        # Read and update JSON
        with gzip.open(json_path, 'rt') as f:
            data = json.load(f)
            
        # Skip if file_path already exists in the JSON
        if 'file_path' in data:
            print(f"Skipping {json_path} - already has file_path")
            continue
            
        # Add file_path and log changes
        print(f"Dict format - adding file_path to existing dict for {json_path}")
        print(f"Original text length: {len(data.get('text', ''))}")
        data['file_path'] = file_path
        print(f"Final text length: {len(data.get('text', ''))}")
        print(f"Word count: {len(data.get('words', []))}")
            
        # Save updated JSON with pretty printing and proper Unicode handling
        with gzip.open(json_path, 'wt') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            
        print(f"Updated {json_path}\n")

    conn.close()

if __name__ == '__main__':
    migrate_json_files()
