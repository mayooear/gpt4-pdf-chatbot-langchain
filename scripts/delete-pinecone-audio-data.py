import os
import argparse
from dotenv import load_dotenv
from pinecone import Pinecone
from audio_utils import get_audio_metadata

def delete_records_by_prefix(index, prefix):
    # List all record IDs with the given prefix
    record_ids = []
    for ids in index.list(prefix=prefix):
        print(f"IDS: {ids}")
        record_ids.extend(ids)
    
    if not record_ids:
        print(f"No records found with prefix '{prefix}'")
        return
    
    # Confirm before deleting records by prefix
    confirmation = input(f"Are you sure you want to delete {len(record_ids)} records with prefix '{prefix}'? (yes/no): ").lower()
    if confirmation == 'yes':
        # Delete records by IDs
        index.delete(ids=record_ids)
        print(f"Deleted {len(record_ids)} records with prefix '{prefix}'")
    else:
        print("Deletion aborted.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Delete audio Pinecone records by file prefix.")
    parser.add_argument("file_path", type=str, help="Path to the MP3 file")
    args = parser.parse_args()

    load_dotenv('../.env')
    
    PINECONE_API_KEY = os.getenv('PINECONE_API_KEY')
    PINECONE_INDEX_NAME = os.getenv('PINECONE_INDEX_NAME')
    
    pc = Pinecone(api_key=PINECONE_API_KEY)
    
    if PINECONE_INDEX_NAME not in pc.list_indexes().names():
        raise ValueError(f"Index '{PINECONE_INDEX_NAME}' does not exist.")
    
    index = pc.Index(PINECONE_INDEX_NAME)
    
    file_path = args.file_path
    title, _ = get_audio_metadata(file_path)
    print(f"Title: {title}")

    prefix = f"audio||Treasures||{title}"
    
    delete_records_by_prefix(index, prefix)