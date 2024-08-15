#!/usr/bin/env python

import os
import argparse
import hashlib
import sqlite3
from pydub import AudioSegment
import shutil
from tqdm import tqdm
import signal
import sys

"""
Audio File Deduplication Script

This script compares audio files between two folders to identify duplicates and copy non-duplicate files 
from the comparison folder to a destination folder.

Functionality:
1. Processes audio files in a source folder and generates content-based hashes.
2. Compares audio files in a comparison folder against the source files.
3. Identifies duplicate files based on their content hash.
4. Copies non-duplicate files from the comparison folder to the specified destination folder, maintaining 
   the original folder structure.
5. Provides detailed output about duplicates and non-duplicates.
6. Caches file hashes to improve performance on subsequent runs.

Usage: 
python dedup-audio-files.py <source_folder> <comparison_folder> <destination_folder>

Supported audio formats: .mp3, .wav, .flac, .ogg, .aac

Notes:
- This script uses content-based hashing, ignoring metadata, to identify duplicates.
- Non-duplicate files are copied from the comparison folder to the destination folder.
- The folder structure from the comparison folder is preserved in the destination folder.
"""

def get_cache_path(comparison_folder):
    return os.path.join(os.path.dirname(os.path.dirname(comparison_folder)), "audio_hash_cache.db")

def init_cache_db(db_path):
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS audio_hashes
                 (file_path TEXT PRIMARY KEY, hash TEXT, mtime REAL)''')
    conn.commit()
    return conn

def load_hash_cache(comparison_folder):
    db_path = get_cache_path(comparison_folder)
    return init_cache_db(db_path)

def save_hash_cache(conn):
    conn.commit()
    conn.close()

def signal_handler(sig, frame):
    print("\nCtrl+C detected. Saving cache and exiting...")
    save_hash_cache(cache_conn)
    sys.exit(0)

def get_audio_hash(file_path, cache_conn):
    try:
        mtime = os.path.getmtime(file_path)
        c = cache_conn.cursor()
        c.execute("SELECT hash FROM audio_hashes WHERE file_path = ? AND mtime = ?", (file_path, mtime))
        result = c.fetchone()
        
        if result:
            return result[0]

        audio = AudioSegment.from_file(file_path)
        audio_hash = hashlib.md5(audio.raw_data).hexdigest()
        c.execute("INSERT OR REPLACE INTO audio_hashes (file_path, hash, mtime) VALUES (?, ?, ?)",
                  (file_path, audio_hash, mtime))
        cache_conn.commit()
        return audio_hash
    except Exception as e:
        print(f"Error processing {file_path}: {str(e)}")
        return None

def get_audio_info(file_path):
    """Get audio file information."""
    try:
        audio = AudioSegment.from_file(file_path)
        return {
            "channels": audio.channels,
            "sample_width": audio.sample_width * 8,
            "frame_rate": audio.frame_rate,
            "bitrate": audio.frame_rate * audio.channels * audio.sample_width * 8,
        }
    except Exception as e:
        print(f"Error getting info for {file_path}: {str(e)}")
        return None

def compare_folders(source_folder, comparison_folder, destination_folder, cache_conn):
    """Compare audio files and report duplicates."""
    source_hashes = {}
    duplicates = []
    non_duplicates = []

    # Process source folder
    print("Processing source folder...")
    if not os.path.exists(source_folder) or not os.access(source_folder, os.R_OK):
        print(f"Error: Cannot access source folder: {source_folder}")
        sys.exit(1)

    source_files = [
        os.path.join(root, file)
        for root, _, files in os.walk(source_folder)
        for file in files
        if file.lower().endswith((".mp3", ".wav", ".flac", ".ogg", ".aac"))
    ]
    for file_path in tqdm(source_files, desc="Hashing source files"):
        file_hash = get_audio_hash(file_path, cache_conn)
        if file_hash:
            source_hashes[file_hash] = file_path

    print(f"Processed {len(source_hashes)} files in source folder.")

    # Process comparison folder
    print(f"\nProcessing comparison folder {comparison_folder}...")
    if not os.path.exists(comparison_folder) or not os.access(
        comparison_folder, os.R_OK
    ):
        print(f"Error: Cannot access comparison folder: {comparison_folder}")
        sys.exit(1)
    comparison_files = [
        os.path.join(root, file)
        for root, _, files in os.walk(comparison_folder)
        for file in files
        if file.lower().endswith((".mp3", ".wav", ".flac", ".ogg", ".aac", ".aif", ".m4a"))
    ]
    print(f"Found {len(comparison_files)} files in comparison folder.")

    for file_path in tqdm(comparison_files, desc="Comparing files"):
        file_hash = get_audio_hash(file_path, cache_conn)
        if file_hash:
            if file_hash in source_hashes:
                duplicate_path = source_hashes[file_hash]
                duplicates.append((file_path, duplicate_path))
            else:
                non_duplicates.append(file_path)

    print(
        f"\nFound {len(duplicates)} duplicates and {len(non_duplicates)} non-duplicates."
    )

    # Report results
    print("\nDuplicate files:")
    for dup, orig in duplicates:
        print(f"  {dup}")
        print(f"    Duplicate of: {orig}")
        dup_info = get_audio_info(dup)
        orig_info = get_audio_info(orig)
        if dup_info != orig_info:
            print("    Note: Audio properties differ")
            print(f"      Duplicate: {dup_info}")
            print(f"      Original: {orig_info}")
        print()

    print("\nNon-duplicate files:")
    for file in non_duplicates:
        print(f"  {file}")

    # Copy non-duplicates to destination folder
    print("\nCopying non-duplicate files...")
    for file in tqdm(non_duplicates, desc="Copying files"):
        rel_path = os.path.relpath(file, comparison_folder)
        dest_path = os.path.join(destination_folder, rel_path)
        os.makedirs(os.path.dirname(dest_path), exist_ok=True)
        shutil.copy2(file, dest_path)

    print(
        f"\nCopied {len(non_duplicates)} non-duplicate files to: {destination_folder}"
    )


def main():
    parser = argparse.ArgumentParser(
        description="Compare audio files and identify duplicates."
    )
    parser.add_argument("source_folder", help="Path to the source folder")
    parser.add_argument(
        "comparison_folder", help="Path to the folder to compare against the source folder"
    )
    parser.add_argument("destination_folder", help="Path to copy non-duplicate files")
    args = parser.parse_args()

    signal.signal(signal.SIGINT, signal_handler)

    global cache_conn
    cache_conn = load_hash_cache(args.comparison_folder)
    try:
        compare_folders(
            args.source_folder, args.comparison_folder, args.destination_folder, cache_conn
        )
    finally:
        save_hash_cache(cache_conn)


if __name__ == "__main__":
    main()