import os
import re
import hashlib
import gzip
import json
from data_ingestion.scripts.transcription_utils import TRANSCRIPTIONS_DIR


def get_file_hash(file_path):
    """Calculate MD5 hash of file content."""
    hasher = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hasher.update(chunk)
    return hasher.hexdigest()

def get_transcription_filename(mp3_filename):
    # Remove the .mp3 extension
    base_name = re.sub(r'\.mp3$', '', mp3_filename, flags=re.IGNORECASE)
    
    # Normalize the filename: replace spaces and special characters with underscores
    normalized_name = re.sub(r'[^\w\s]', '', base_name)  # Remove special characters
    normalized_name = re.sub(r'\s+', '_', normalized_name)  # Replace spaces with underscores
    
    # Generate file hash
    file_hash = get_file_hash(mp3_filename)
    
    # Construct the transcription filename
    transcription_filename = f"{file_hash}.json.gz"
    
    return transcription_filename

def display_transcription_file(transcription_filename):
    full_path = os.path.join(TRANSCRIPTIONS_DIR, transcription_filename)
    if not os.path.exists(full_path):
        print(f"Transcription file {full_path} does not exist.")
        return
    
    with gzip.open(full_path, "rt", encoding="utf-8") as f:
        transcription_data = json.load(f)
        if isinstance(transcription_data, list):
            for entry in transcription_data:
                if 'text' in entry:
                    print(entry['text'])
        else:
            if 'text' in transcription_data:
                print(transcription_data['text'])

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Convert MP3 filename to transcription filename and display its contents.")
    parser.add_argument("mp3_filename", type=str, help="The MP3 filename to convert.")
    
    args = parser.parse_args()
    
    transcription_filename = get_transcription_filename(args.mp3_filename)
    print(f"Transcription filename: {transcription_filename}")
    
    display_transcription_file(transcription_filename)