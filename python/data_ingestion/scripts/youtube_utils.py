"""
YouTube Media Processing Utilities

This module provides functionality for downloading and processing YouTube content:
- Downloads audio from YouTube videos with retry logic for rate limits
- Extracts and manages video metadata
- Handles playlist processing
- Maintains a data mapping system for tracking processed videos
- Adds ID3 metadata tags to downloaded MP3 files

Key Features:
- Exponential backoff retry logic for 403 errors
- Random jitter to prevent thundering herd issues
- Unique file naming to prevent collisions
- Robust error handling and logging
- Metadata preservation in both files and tracking system
"""

import json
import os
import random
import uuid
import logging
from yt_dlp import YoutubeDL
from mutagen.mp3 import MP3
from mutagen.id3 import ID3, TIT2, TPE1, TALB, COMM
import re
import time
from yt_dlp.utils import DownloadError

# Set up logging
logger = logging.getLogger(__name__)

# Update the path to be relative to the project root
YOUTUBE_DATA_MAP_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "data_ingestion",
    "media",
    "youtube_data_map.json"
)


def extract_youtube_id(url: str) -> str:
    """Extracts the 11-character YouTube video ID from various URL formats"""
    # Handles both v= parameter and shortened URLs
    match = re.search(r"(?:v=|\/)([0-9A-Za-z_-]{11}).*", url)
    return match.group(1) if match else None

def download_youtube_audio(url: str, output_path: str = "."):
    """
    Downloads and processes YouTube audio with retry logic.
    
    Implements exponential backoff with random jitter for 403 errors:
    - First retry: 30-45 seconds
    - Second retry: 60-75 seconds
    - Third retry: 120-135 seconds
    
    Returns metadata dict on success, None on failure
    """
    youtube_id = extract_youtube_id(url)
    if not youtube_id:
        logger.error("Invalid YouTube URL. Could not extract YouTube ID.")
        return None

    # Generate unique filename to prevent collisions in concurrent downloads
    random_filename = str(uuid.uuid4())

    # Configure yt-dlp for best quality audio extraction
    ydl_opts = {
        "format": "bestaudio/best",
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "mp3",
            "preferredquality": "192",  # Balanced quality vs size
        }],
        "outtmpl": os.path.join(output_path, f"{random_filename}.%(ext)s"),
        "noplaylist": True,
        "extract_flat": False,
    }

    max_retries = 3
    for attempt in range(max_retries):
        try:
            with YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)

                audio_path = os.path.join(output_path, f"{random_filename}.mp3")

                # Verify file was actually created
                if not os.path.exists(audio_path):
                    raise FileNotFoundError(f"Could not find the downloaded MP3 file: {audio_path}")

                # Track file size for quota management
                file_size = os.path.getsize(audio_path)

            # Preserve metadata both in file and return value
            metadata = {
                "title": info["title"],
                "author": info["uploader"],
                "description": info.get("description", ""),
            }
            add_metadata_to_mp3(audio_path, metadata, url)

            logger.info(f"Downloaded and extracted audio successfully: {info['title']}")
            logger.info(f"File saved as: {audio_path}")

            return {
                "audio_path": audio_path,
                "title": info["title"],
                "author": info["uploader"],
                "url": url,
                "youtube_id": youtube_id,
                "file_size": file_size,
            }
        except DownloadError as e:
            error_msg = str(e)
            if "Private video" in error_msg:
                logger.error(f"Cannot access private video: {url}")
                return {
                    "error": "private_video",
                    "message": "This video is private and cannot be accessed",
                    "youtube_id": youtube_id,
                    "url": url
                }
            elif "HTTP Error 403: Forbidden" in error_msg:
                # Rate limit hit - implement backoff unless final attempt
                if attempt < max_retries - 1:
                    sleep_time = 30 * (2**attempt)  # 30, 60, 120 seconds base
                    jitter = random.uniform(0, 15)  # Prevent thundering herd
                    total_sleep_time = sleep_time + jitter
                    logger.warning(f"403 Forbidden error. Retrying in {total_sleep_time:.2f} seconds...")
                    time.sleep(total_sleep_time)
                else:
                    logger.error("Max retries reached. Unable to download due to 403 Forbidden error.")
                    return None
            else:
                logger.error(f"YouTube download error: {error_msg}")
                return None
        except Exception as e:
            logger.error(f"An error occurred while downloading YouTube audio: {e}")
            return None

    return None  # If we've exhausted all retries

def add_metadata_to_mp3(mp3_path: str, metadata: dict, url: str):
    """
    Adds ID3 tags to MP3 file for metadata preservation.
    
    Tags added:
    - TIT2: Title
    - TPE1: Artist/Author
    - TALB: Album (set to "YouTube")
    - COMM: Two comment fields for description and source URL
    """
    try:
        audio = MP3(mp3_path, ID3=ID3)
        # Create ID3 tag structure if not present
        if audio.tags is None:
            audio.add_tags()

        audio.tags.add(TIT2(encoding=3, text=metadata["title"]))
        audio.tags.add(TPE1(encoding=3, text=metadata["author"]))
        audio.tags.add(TALB(encoding=3, text="YouTube"))
        audio.tags.add(
            COMM(encoding=3, lang="eng", desc="desc", text=metadata["description"])
        )
        audio.tags.add(COMM(encoding=3, lang="eng", desc="url", text=url))

        audio.save()
        logger.info("Metadata added successfully to MP3.")
        
    except Exception as e:
        logger.error(f"An error occurred while adding metadata to MP3: {e}")

def load_youtube_data_map():
    if os.path.exists(YOUTUBE_DATA_MAP_PATH):
        with open(YOUTUBE_DATA_MAP_PATH, "r") as f:
            return json.load(f)
    return {}

def save_youtube_data_map(youtube_data_map):
    with open(YOUTUBE_DATA_MAP_PATH, "w") as f:
        json.dump(youtube_data_map, f, ensure_ascii=False, indent=2)

def get_playlist_videos(playlist_url: str, output_path: str = "."):
    """
    Extracts video information from YouTube playlists.
    
    Uses exponential backoff with random jitter for retries:
    - Base delay: 5 seconds
    - Each retry doubles the delay
    - Adds 0-1 second random jitter
    
    Returns list of dicts containing video URLs and IDs
    """
    # Custom retry delay function with jitter
    def exponential_sleep(attempt):
        return 5 * (2 ** attempt) + random.uniform(0, 1)

    # Configure yt-dlp for metadata-only extraction
    ydl_opts = {
        "extract_flat": True,  # Don't download videos
        "force_generic_extractor": True,
        "ignoreerrors": True,  # Continue on per-video errors
        "retry_sleep_functions": {
            "http": exponential_sleep,
            "fragment": exponential_sleep,
            "file_access": exponential_sleep,
        },
    }

    try:
        with YoutubeDL(ydl_opts) as ydl:
            playlist_info = ydl.extract_info(playlist_url, download=False)

            if "entries" not in playlist_info:
                raise ValueError("Unable to find videos in the playlist")

            print(f"Found playlist: {playlist_info.get('title', 'Unknown')}")
            print(f"Total videos: {len(playlist_info['entries'])}")

            videos = []
            for entry in playlist_info["entries"]:
                videos.append(
                    {
                        "url": f"https://www.youtube.com/watch?v={entry['id']}",
                        "youtube_id": entry["id"],
                    }
                )

            logging.debug(f"Videos from playlist:\n{videos}")
            return videos

    except Exception as e:
        print(f"An error occurred while fetching playlist videos: {e}")
        return []