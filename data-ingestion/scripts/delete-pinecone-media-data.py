#!/usr/bin/env python3

"""
Delete Pinecone Media Data Script

This script deletes Pinecone records associated with a specific media type
from a specified library and optionally a specific title. It's designed to help
manage and clean up data in a Pinecone index used for media content storage and retrieval.

Functionality:
- Accepts command-line arguments for file type (required), optional library name, and optional title
- Constructs a prefix based on file type, library name (if provided), and title (if provided)
- Retrieves and deletes all Pinecone records matching the constructed prefix

Usage:
python delete-pinecone-media-data.py --file-type <audio|text|youtube_video> [--library <library_name>] [--title <title>]

Examples:
1. Delete all audio records:
   python delete-pinecone-media-data.py --file-type audio

2. Delete all audio records from a specific library:
   python delete-pinecone-media-data.py --file-type audio --library bhaktan

3. Delete a specific title from a library:
   python delete-pinecone-media-data.py --file-type audio --library bhaktan --title "Week 04 - 05"

Note: This script will prompt for confirmation before deleting records to prevent
accidental data loss. The --title option can only be used when --library is specified.
"""

import os
import argparse
from dotenv import load_dotenv
from pinecone import Pinecone

def construct_prefix(file_type, library=None, title=None):
    prefix = f"{file_type}||"
    if library:
        prefix += f"{library}||"
        if title:
            prefix += f"{title}||"
    return prefix

def delete_records_by_prefix(index, prefix):
    # List all record IDs with the given prefix
    record_ids = []
    for ids in index.list(prefix=prefix):
        record_ids.extend(ids)

    if not record_ids:
        print(f"No records found with prefix '{prefix}'")
        return

    # Confirm before deleting records by prefix
    confirmation = input(
        f"Are you sure you want to delete {len(record_ids)} records with prefix:\n'{prefix}'\n(yes/no): "
    ).lower()
    if confirmation in ["yes", "y"]:
        # Delete records by IDs
        index.delete(ids=record_ids)
        print(f"Deleted {len(record_ids)} records with prefix '{prefix}'")
    else:
        print("Deletion aborted.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Delete Pinecone records by file type, optional library name, and optional title."
    )
    parser.add_argument(
        "--file-type",
        type=str,
        required=True,
        choices=["audio", "text", "youtube_video"],
        help="Type of the media (audio, text, or youtube_video)",
    )
    parser.add_argument(
        "--library", type=str, help="Name of the library (optional)"
    )
    parser.add_argument(
        "--title", type=str, help="Title of the media (optional, requires --library)"
    )
    args = parser.parse_args()

    load_dotenv("../../.env")

    PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
    PINECONE_INDEX_NAME = os.getenv("PINECONE_INGEST_INDEX_NAME")

    if not PINECONE_API_KEY or not PINECONE_INDEX_NAME:
        raise ValueError("PINECONE_API_KEY and PINECONE_INGEST_INDEX_NAME must be set in the environment or .env file.")

    print(f"PINECONE_INDEX_NAME: {PINECONE_INDEX_NAME}")
    pc = Pinecone(api_key=PINECONE_API_KEY)

    if PINECONE_INDEX_NAME not in pc.list_indexes().names():
        raise ValueError(f"Index '{PINECONE_INDEX_NAME}' does not exist.")

    index = pc.Index(PINECONE_INDEX_NAME)

    file_type = args.file_type
    library_name = args.library
    title = args.title

    if title and not library_name:
        parser.error("--title requires --library to be specified")

    print(f"File Type: {file_type}")
    if library_name:
        print(f"Library: {library_name}")
    if title:
        print(f"Title: {title}")

    prefix = construct_prefix(file_type, library_name, title)
    print(f"Constructed prefix: {prefix}")

    delete_records_by_prefix(index, prefix)