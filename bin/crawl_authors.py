#!/usr/bin/env python

import os
from mutagen.mp3 import MP3
from mutagen.id3 import ID3NoHeaderError
from mutagen.wave import WAVE
import logging

logger = logging.getLogger(__name__)

# Mapping for author names
AUTHOR_MAPPING = {
    "Unknown Artist": "Unknown",
    "Error": "Unknown",
    "self": "Unknown",
    "supercliving": "Unknown",
    "Swami Kriyanananda": "Swami Kriyananda",
    "J. Donald Walters": "Swami Kriyananda",
    "Kriyananda": "Swami Kriyananda",
    "Swami": "Swami Kriyananda",
    "Ananda Course": "Swami Kriyananda",
    "A Way to Awakening SC21 (81-84)": "Swami Kriyananda",
    "Treasures Along The Path": "Swami Kriyananda",
    "Treasures Along the Path": "Swami Kriyananda",
    "christmas": "Swami Kriyananda",
    "Treasures Along The Path - Peggy Brady": "Peggy Brady",
    "Ananda Sangha Worldwide": "Swami Kriyananda",
}

def get_author(file_path):
    file_extension = os.path.splitext(file_path)[1].lower()
    try:
        if file_extension == '.mp3':
            audio = MP3(file_path)
            if audio.tags:
                author = audio.tags.get("TPE1", ["Unknown"])[0]
            else:
                author = "Unknown"
        elif file_extension == '.wav':
            audio = WAVE(file_path)
            author = audio.get("artist", "Unknown")
        else:
            author = "Unsupported format"
    except Exception as e:
        logger.error(f"Error reading audio metadata for {file_path}: {e}")
        author = "Error"
    
    # Strip leading and trailing spaces and normalize author name using the mapping
    author = author.strip()
    return AUTHOR_MAPPING.get(author, author)

def crawl_directory(directory_path):
    author_counts = {}
    author_files = {}

    for root, _, files in os.walk(directory_path):
        for file in files:
            if file.lower().endswith((".mp3", ".wav")):
                file_path = os.path.join(root, file)
                author = get_author(file_path)
                if author not in author_counts:
                    author_counts[author] = 0
                    author_files[author] = []
                author_counts[author] += 1
                author_files[author].append(file_path)

    return author_counts, author_files

def print_results(author_counts, author_files):
    print("Author Counts:")
    for author, count in author_counts.items():
        print(f"{author}: {count}")

    print("\nFiles grouped by author (except Swami Kriyananda):")
    for author, files in author_files.items():
        if author != "Swami Kriyananda":
            print(f"\nAuthor: '{author}'")
            for file_path in files:
                print(f"""  open "{file_path}" """)

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Crawl a directory and count author names in audio files.")
    parser.add_argument("directory", help="Path to the directory to crawl")
    args = parser.parse_args()

    author_counts, author_files = crawl_directory(args.directory)
    print_results(author_counts, author_files)