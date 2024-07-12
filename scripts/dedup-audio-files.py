import os
import argparse
import hashlib
import json
from pydub import AudioSegment
import shutil
from tqdm import tqdm
import signal
import sys

HASH_CACHE_FILE = "../audio/hash-cache/audio_hashes.json"
hash_cache = {}

def load_hash_cache():
    global hash_cache
    if os.path.exists(HASH_CACHE_FILE):
        with open(HASH_CACHE_FILE, 'r') as f:
            hash_cache = json.load(f)
    return hash_cache

def save_hash_cache():
    os.makedirs(os.path.dirname(HASH_CACHE_FILE), exist_ok=True)
    with open(HASH_CACHE_FILE, 'w') as f:
        json.dump(hash_cache, f)

def signal_handler(sig, frame):
    print("\nCtrl+C detected. Saving cache and exiting...")
    save_hash_cache()
    sys.exit(0)

def get_audio_hash(file_path):
    """Generate a hash of the audio content without metadata, using cache if possible."""
    try:
        mtime = os.path.getmtime(file_path)
        if file_path in hash_cache and hash_cache[file_path]["mtime"] == mtime:
            return hash_cache[file_path]["hash"]
        
        audio = AudioSegment.from_file(file_path)
        audio_hash = hashlib.md5(audio.raw_data).hexdigest()
        hash_cache[file_path] = {"hash": audio_hash, "mtime": mtime}
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
            "bitrate": audio.frame_rate * audio.channels * audio.sample_width * 8
        }
    except Exception as e:
        print(f"Error getting info for {file_path}: {str(e)}")
        return None

def compare_folders(treasures_folder, comparison_folder, destination_folder):
    """Compare audio files and report duplicates."""
    treasures_hashes = {}
    duplicates = []
    non_duplicates = []

    # Process treasures folder
    print("Processing treasures folder...")
    if not os.path.exists(treasures_folder) or not os.access(treasures_folder, os.R_OK):
        print(f"Error: Cannot access treasures folder: {treasures_folder}")
        sys.exit(1)
    
    treasures_files = [os.path.join(root, file) for root, _, files in os.walk(treasures_folder) 
                                             for file in files if file.lower().endswith(('.mp3', '.wav', '.flac', '.ogg', '.aac'))]
    for file_path in tqdm(treasures_files, desc="Hashing treasures"):
        file_hash = get_audio_hash(file_path)
        if file_hash:
            treasures_hashes[file_hash] = file_path

    print(f"Processed {len(treasures_hashes)} files in treasures folder.")

    # Process comparison folder
    print(f"\nProcessing comparison folder {comparison_folder}...")
    if not os.path.exists(comparison_folder) or not os.access(comparison_folder, os.R_OK):
        print(f"Error: Cannot access comparison folder: {comparison_folder}")
        sys.exit(1)
    comparison_files = [os.path.join(root, file) for root, _, files in os.walk(comparison_folder) 
                        for file in files if file.lower().endswith(('.mp3', '.wav', '.flac', '.ogg', '.aac'))]
    print(f"Found {len(comparison_files)} files in comparison folder.")

    for file_path in tqdm(comparison_files, desc="Comparing files"):
        file_hash = get_audio_hash(file_path)
        if file_hash:
            if file_hash in treasures_hashes:
                duplicate_path = treasures_hashes[file_hash]
                duplicates.append((file_path, duplicate_path))
            else:
                non_duplicates.append(file_path)

    print(f"\nFound {len(duplicates)} duplicates and {len(non_duplicates)} non-duplicates.")

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

    print(f"\nCopied {len(non_duplicates)} non-duplicate files to: {destination_folder}")

def main():
    parser = argparse.ArgumentParser(description="Compare audio files and identify duplicates.")
    parser.add_argument("treasures_folder", help="Path to the treasures folder")
    parser.add_argument("comparison_folder", help="Path to the folder to compare against treasures")
    parser.add_argument("destination_folder", help="Path to copy non-duplicate files")
    args = parser.parse_args()

    signal.signal(signal.SIGINT, signal_handler)
    
    load_hash_cache()
    try:
        compare_folders(args.treasures_folder, args.comparison_folder, args.destination_folder)
    finally:
        save_hash_cache()

if __name__ == "__main__":
    main()