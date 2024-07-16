import os
import argparse
from dotenv import load_dotenv
from pinecone import Pinecone
from media_utils import get_media_metadata, get_file_type

def delete_records_by_prefix(index, prefix):
    # List all record IDs with the given prefix
    record_ids = []
    for ids in index.list(prefix=prefix):
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
    parser = argparse.ArgumentParser(description="Delete Pinecone records by file prefix for audio or video files.")
    parser.add_argument("file_path", type=str, help="Path to the media file (audio or video)")
    parser.add_argument("--library", type=str, help="Name of the library")
    args = parser.parse_args()

    load_dotenv('../.env')
    
    PINECONE_API_KEY = os.getenv('PINECONE_API_KEY')
    PINECONE_INDEX_NAME = os.getenv('PINECONE_INGEST_INDEX_NAME')
    
    pc = Pinecone(api_key=PINECONE_API_KEY)
    
    if PINECONE_INDEX_NAME not in pc.list_indexes().names():
        raise ValueError(f"Index '{PINECONE_INDEX_NAME}' does not exist.")
    
    index = pc.Index(PINECONE_INDEX_NAME)
    
    file_path = args.file_path
    library_name = args.library
    file_type = get_file_type(file_path)
    title, _, _ = get_media_metadata(file_path)
    print(f"File Type: {file_type}")
    print(f"Title: {title}")
    print(f"Library: {library_name}")

    prefix = f"{file_type}||{library_name}||{title}"
    
    delete_records_by_prefix(index, prefix)