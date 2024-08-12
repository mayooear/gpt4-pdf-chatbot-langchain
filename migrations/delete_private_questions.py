#!/usr/bin/env python

import argparse
import os
from google.cloud import firestore
from google.oauth2 import service_account
import json
from dotenv import load_dotenv

def initialize_firestore(env_prefix):
    # Load the service account credentials from the JSON string
    credentials_json = os.getenv("FIREBASE_ADMINSDK_JSON")
    if not credentials_json:
        raise ValueError("FIREBASE_ADMINSDK_JSON environment variable is not set or is empty")

    try:
        credentials_dict = json.loads(credentials_json)
        credentials = service_account.Credentials.from_service_account_info(credentials_dict)
    except json.JSONDecodeError as e:
        raise ValueError(f"Error decoding JSON from FIREBASE_ADMINSDK_JSON: {e}")

    # Unset FIRESTORE_EMULATOR_HOST for production
    if env_prefix == "prod" and "FIRESTORE_EMULATOR_HOST" in os.environ:
        del os.environ["FIRESTORE_EMULATOR_HOST"]

    try:
        return firestore.Client(credentials=credentials)
    except Exception as e:
        raise RuntimeError(f"Error initializing Firestore: {e}")

def delete_private_entries(db, env_prefix, dry_run=False):
    collection_name = f"{env_prefix}_chatLogs"
    print(f"Searching in collection: {collection_name}")
    
    # First, let's count all documents in the collection
    all_docs = db.collection(collection_name).stream()
    total_count = sum(1 for _ in all_docs)
    print(f"Total documents in collection: {total_count}")
    
    # Now, let's query for the private documents
    query = db.collection(collection_name).where(filter=firestore.FieldFilter("question", "==", "private"))
    docs = query.stream()
    
    deleted_count = 0
    for doc in docs:
        doc_data = doc.to_dict()
        timestamp = doc_data.get('timestamp', 'No timestamp')
        print(f"ID: {doc.id} | Question: {doc_data.get('question', 'No question')} | Timestamp: {timestamp}")
        if not dry_run:
            doc.reference.delete()
        deleted_count += 1
    
    if dry_run:
        print(f"Found {deleted_count} private entries in '{collection_name}' collection")
    else:
        print(f"Deleted {deleted_count} private entries from '{collection_name}' collection")
    
    if deleted_count == 0:
        print("No private entries found. Showing a sample of documents:")
        sample_docs = db.collection(collection_name).limit(25).stream()
        for doc in sample_docs:
            doc_data = doc.to_dict()
            print(f"Sample - ID: {doc.id} | Question: {doc_data.get('question', 'No question')} | Timestamp: {doc_data.get('timestamp', 'No timestamp')}")
        
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Delete private entries from Firestore chatLogs collection.')
    parser.add_argument('-e', '--env', type=str, choices=['dev', 'prod'], required=True, help='Environment (dev or prod)')
    parser.add_argument('--dry-run', action='store_true', help='Perform a dry run without deleting entries')
    args = parser.parse_args()

    # Determine the directory of the script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    env_path = os.path.join(script_dir, '../.env')

    # Load environment variables from .env file
    load_dotenv(env_path)

    env_prefix = args.env
    try:
        db = initialize_firestore(env_prefix)
    except Exception as e:
        print(f"Error initializing Firestore: {e}")
        exit(1)

    delete_private_entries(db, env_prefix, args.dry_run)