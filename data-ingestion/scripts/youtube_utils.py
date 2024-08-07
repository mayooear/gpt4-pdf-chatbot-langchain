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

YOUTUBE_DATA_MAP_PATH = "../media/youtube_data_map.json"


def extract_youtube_id(url: str) -> str:
    match = re.search(r"(?:v=|\/)([0-9A-Za-z_-]{11}).*", url)
    return match.group(1) if match else None


def download_youtube_audio(url: str, output_path: str = "."):
    youtube_id = extract_youtube_id(url)
    if not youtube_id:
        logger.error("Invalid YouTube URL. Could not extract YouTube ID.")
        return None

    random_filename = str(uuid.uuid4())

    ydl_opts = {
        "format": "bestaudio/best",
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "192",
            }
        ],
        "outtmpl": os.path.join(output_path, f"{random_filename}.%(ext)s"),
    }

    max_retries = 3
    for attempt in range(max_retries):
        try:
            with YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)

                audio_path = os.path.join(output_path, f"{random_filename}.mp3")

                if not os.path.exists(audio_path):
                    raise FileNotFoundError(
                        f"Could not find the downloaded MP3 file: {audio_path}"
                    )

                # Get the file size of the MP3
                file_size = os.path.getsize(audio_path)

            # Get and add metadata to MP3
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
            if "HTTP Error 403: Forbidden" in str(e):
                if attempt < max_retries - 1:  # don't sleep after the last attempt
                    sleep_time = 30 * (2**attempt)  # 30, 60, 120 seconds
                    jitter = random.uniform(0, 15)  # Add up to 15 seconds jitter
                    total_sleep_time = sleep_time + jitter
                    logger.warning(
                        f"403 Forbidden error. Retrying in {total_sleep_time:.2f} seconds..."
                    )
                    time.sleep(total_sleep_time)
                else:
                    logger.error(
                        "Max retries reached. Unable to download due to 403 Forbidden error."
                    )
                    return None
            else:
                logger.error(f"An error occurred while downloading YouTube audio: {e}")
                return None
        except Exception as e:
            logger.error(f"An error occurred while downloading YouTube audio: {e}")
            return None

    return None  # If we've exhausted all retries


def add_metadata_to_mp3(mp3_path: str, metadata: dict, url: str):
    try:
        audio = MP3(mp3_path, ID3=ID3)

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
    def exponential_sleep(attempt):
        return 5 * (2 ** attempt) + random.uniform(0, 1)

    ydl_opts = {
        "extract_flat": True,
        "force_generic_extractor": True,
        "ignoreerrors": True,
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