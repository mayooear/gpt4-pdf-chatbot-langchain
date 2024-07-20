import os
import tempfile
import sqlite3
import gzip
import json
import time
from openai import OpenAI, APIError, APITimeoutError
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)
from tqdm import tqdm
from media_utils import get_file_hash, split_audio, get_media_metadata
from youtube_utils import load_youtube_data_map, save_youtube_data_map
import logging
from moviepy.editor import VideoFileClip
from pydub import AudioSegment

logger = logging.getLogger(__name__)

TRANSCRIPTIONS_DB_PATH = "../media/transcriptions.db"
TRANSCRIPTIONS_DIR = "../media/transcriptions"

# Global list to store chunk lengths
chunk_lengths = []


class UnsupportedAudioFormatError(Exception):
    pass


class RateLimitError(Exception):
    """Custom exception for rate limit errors"""

    pass


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10),
    retry=retry_if_exception_type((APITimeoutError, APIError)),
    reraise=False,
)
def transcribe_chunk(
    client, chunk, previous_transcript=None, cumulative_time=0, file_name=""
):
    try:
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as temp_file:
            chunk.export(temp_file.name, format="mp3")

            transcription_options = {
                "file": open(temp_file.name, "rb"),
                "model": "whisper-1",
                "response_format": "verbose_json",
                "timestamp_granularities": ["word"],
            }

            if previous_transcript:
                transcription_options["prompt"] = previous_transcript

            transcript = client.audio.transcriptions.create(**transcription_options)

            transcription_options["file"].close()

        os.unlink(temp_file.name)
        transcript_dict = transcript.model_dump()

        if "words" not in transcript_dict:
            logger.error(
                f"'words' not found in transcript. Full response: {transcript_dict}"
            )
            return None

        # Adjust timestamps for words
        for word in transcript_dict["words"]:
            word["start"] = round(word["start"] + cumulative_time, 2)
            word["end"] = round(word["end"] + cumulative_time, 2)

        # Create a simplified structure similar to the old 'segments' format
        simplified_transcript = {
            "text": transcript_dict["text"],
            "words": transcript_dict["words"],
        }

        return simplified_transcript
    except APITimeoutError:
        logger.error(f"OpenAI API request timed out for file {file_name}. Retrying...")
        raise
    except APIError as e:
        if e.code == 429:
            logger.error(
                f"OpenAI API error for file {file_name}: {e}. Rate limit exceeded."
            )
            raise RateLimitError("Rate limit exceeded")
        elif (
            e.code == 400
            and "The audio file could not be decoded or its format is not supported."
            in str(e)
        ):
            logger.error(
                f"OpenAI API error for file {file_name}: {e}. The audio file could not be decoded or its format is not supported. Skipping this chunk."
            )
            raise UnsupportedAudioFormatError(
                f"Unsupported audio format for file {file_name}"
            )
        logger.error(f"OpenAI API error for file {file_name}: {e}")
        raise
    except Exception as e:
        logger.error(f"Error transcribing chunk for file {file_name}: {str(e)}")
        logger.error(
            f"Full response: {transcript_dict if 'transcript_dict' in locals() else 'Not available'}"
        )
        return None


def init_db():
    """Initialize SQLite database for transcription indexing."""
    conn = sqlite3.connect(TRANSCRIPTIONS_DB_PATH)
    c = conn.cursor()

    # Check if the table already exists
    c.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='transcriptions'"
    )
    if not c.fetchone():
        response = input(
            "Warning: sqlite 'transcriptions' table does not exist. Do you want to create a new table? (yes/no): "
        )
        if response.lower() == "yes":
            c.execute(
                """CREATE TABLE IF NOT EXISTS transcriptions
                         (file_hash TEXT PRIMARY KEY, file_path TEXT, timestamp REAL, json_file TEXT)"""
            )
        else:
            logger.info("Table creation aborted.")
            conn.close()
            return

    conn.commit()
    conn.close()


def get_saved_transcription(file_path, is_youtube_video=False, youtube_id=None):
    """
    Retrieve transcription for a given file or YouTube video.

    This function loads the saved transcription from the corresponding gzipped JSON file,
    if it exists.

    For Youtube videos, file_path is None
    """

    if is_youtube_video:
        if not youtube_id:
            raise ValueError("YouTube ID is required for YouTube videos")
        youtube_data_map = load_youtube_data_map()
        youtube_data = youtube_data_map.get(youtube_id)

        # erase any audio path stored with youtube data as it's bogus (from prior run)
        youtube_data["audio_path"] = None

        if youtube_data:
            youtube_data.pop("audio_path", None)
            file_hash = youtube_data["file_hash"]
        else:
            return None
    else:
        file_hash = get_file_hash(file_path)

    conn = sqlite3.connect(TRANSCRIPTIONS_DB_PATH)
    c = conn.cursor()
    c.execute("SELECT json_file FROM transcriptions WHERE file_hash = ?", (file_hash,))
    result = c.fetchone()
    conn.close()

    if result:
        json_file = result[0]
        logger.info(
            f"get_transcription: Using existing transcription for {'YouTube video' if is_youtube_video else 'file'} {youtube_id or file_path} ({file_hash})"
        )

        # Ensure we're using the full path to the JSON file
        full_json_path = os.path.join(TRANSCRIPTIONS_DIR, json_file)
        if os.path.exists(full_json_path):
            # Load the transcription from the gzipped JSON file
            with gzip.open(full_json_path, "rt", encoding="utf-8") as f:
                transcriptions = json.load(f)
                # old format saved was an array of transcriptions and new format
                # is a single transcription
                if isinstance(transcriptions, list):
                    combined_transcription = combine_transcriptions(transcriptions) 
                    return combined_transcription
                else:
                    return transcriptions
        else:
            logger.warning(f"JSON file not found at {full_json_path}")
    return None


def save_transcription(file_path, transcripts):
    """
    Save transcription using the hybrid approach:
    1. Store the raw transcription data in a gzipped JSON file.
    2. Save the file's metadata and location in the SQLite database for quick indexing.
    """
    file_hash = get_file_hash(file_path)
    json_file = f"{file_hash}.json.gz"
    full_json_path = os.path.join(TRANSCRIPTIONS_DIR, json_file)

    # Ensure the transcriptions directory exists
    os.makedirs(TRANSCRIPTIONS_DIR, exist_ok=True)

    # Save the transcription data as a gzipped JSON file
    with gzip.open(full_json_path, "wt", encoding="utf-8") as f:
        json.dump(transcripts, f, ensure_ascii=False, indent=2)

    # Update the SQLite database with the file's metadata and transcription location
    conn = sqlite3.connect(TRANSCRIPTIONS_DB_PATH)
    c = conn.cursor()
    c.execute(
        "INSERT OR REPLACE INTO transcriptions (file_hash, file_path, timestamp, json_file) VALUES (?, ?, ?, ?)",
        (file_hash, file_path, time.time(), json_file),
    )
    conn.commit()
    conn.close()

def combine_transcriptions(transcriptions):
    """
    Combine an array of transcriptions into a single transcription.

    This function takes a list of transcription dictionaries and combines them into a single
    transcription dictionary. The combined transcription will have concatenated text and merged
    metadata, including words and duration.

    Args:
        transcriptions (list): A list of transcription dictionaries to combine.

    Returns:
        dict: A single combined transcription dictionary.
    """
    if not transcriptions:
        return {}

    combined_transcription = {
        "text": "",
        "words": [],
    }

    for transcription in transcriptions:
        combined_transcription["text"] += " " + transcription["text"] + " "
        combined_transcription["words"].extend(transcription["words"])

    return combined_transcription

def transcribe_media(
    file_path,
    force=False,
    is_youtube_video=False,
    youtube_id=None,
    interrupt_event=None,
):
    """
    Transcribe audio file, using existing transcription if available and not forced.

    This function first checks for an existing transcription using the hybrid storage system.
    If not found or if force is True, it performs the transcription and saves the result.
    """

    file_name = os.path.basename(file_path) if file_path else f"YouTube_{youtube_id}"

    existing_transcription = get_saved_transcription(file_path, is_youtube_video, youtube_id)
    if existing_transcription and not force:
        logger.debug(f"transcribe_media: Using existing transcription")
        return existing_transcription

    client = OpenAI()

    logger.info(f"Splitting audio into chunks for {file_name}...")

    # Split the audio into chunks
    chunks = split_audio(file_path)

    logger.info(f"Audio split into {len(chunks)} chunks for {file_name}")

    transcripts = []
    previous_transcript = None
    cumulative_time = 0

    for i, chunk in enumerate(
        tqdm(chunks, desc=f"Transcribing chunks for {file_name}", unit="chunk")
    ):
        if interrupt_event and interrupt_event.is_set():
            logger.info("Interrupt detected. Stopping transcription...")
            break

        try:
            transcript = transcribe_chunk(
                client, chunk, previous_transcript, cumulative_time, file_name
            )
            if transcript:
                transcripts.append(transcript)
                previous_transcript = transcript["text"]
                cumulative_time += chunk.duration_seconds
            else:
                logger.error(
                    f"Empty or invalid transcript for chunk {i+1} in {file_name}"
                )
        except RateLimitError:
            logger.error(f"Rate limit exceeded. Terminating process.")
            return None
        except UnsupportedAudioFormatError as e:
            logger.error(f"{e}. Stopping processing for file {file_name}.")
            return None
        except Exception as e:
            logger.error(
                f"Error transcribing chunk {i+1} for file {file_name}. Exception: {str(e)}"
            )

    if len(transcripts) < len(chunks):
        logger.error(
            f"Failed. Not all chunks were successfully transcribed for {file_name}. {len(transcripts)} out of {len(chunks)} chunks processed."
        )
        return None

    if transcripts:
        combined_transcription = combine_transcriptions(transcripts)    
        save_transcription(file_path, combined_transcription)
        return combined_transcription

    logger.error(f"No transcripts generated for {file_name}")
    return None


def combine_small_chunks(chunks, min_chunk_size, max_chunk_size):
    i = 0
    combined = False
    while i < len(chunks) - 1:
        current_chunk = chunks[i]
        next_chunk = chunks[i + 1]

        if (
            len(current_chunk["words"]) < min_chunk_size
            or len(next_chunk["words"]) < min_chunk_size
        ):
            if len(current_chunk["words"]) + len(next_chunk["words"]) <= max_chunk_size:
                # Combine chunks
                time_offset = current_chunk["end"] - next_chunk["start"]
                for word in next_chunk["words"]:
                    word["start"] += time_offset
                    word["end"] += time_offset
                current_chunk["text"] += " " + next_chunk["text"]
                current_chunk["end"] = next_chunk["end"]
                current_chunk["words"].extend(next_chunk["words"])
                chunks.pop(i + 1)
                combined = True
            else:
                # Move to next chunk if combining would exceed max_chunk_size
                i += 1
        else:
            i += 1

    if combined:
        logger.debug("Chunk sizes after combination:")
        for idx, chunk in enumerate(chunks):
            logger.debug(f"Chunk {idx + 1}: {len(chunk['words'])} words")

    return chunks


def chunk_transcription(transcript, target_chunk_size=150, overlap=75):
    global chunk_lengths  # Ensure we are using the global list
    chunks = []
    words = transcript["words"]
    total_words = len(words)

    # Calculate the number of chunks needed
    num_chunks = (total_words + target_chunk_size - 1) // target_chunk_size

    # Adjust chunk size to ensure even distribution
    adjusted_chunk_size = (total_words + num_chunks - 1) // num_chunks

    i = 0
    while i < total_words:
        end_index = min(i + adjusted_chunk_size, total_words)
        current_chunk = words[i:end_index]
        if not current_chunk:
            break

        chunk_text = " ".join([w["word"] for w in current_chunk])
        start_time = current_chunk[0]["start"]
        end_time = current_chunk[-1]["end"]

        chunks.append(
            {
                "text": chunk_text,
                "start": start_time,
                "end": end_time,
                "words": current_chunk,
            }
        )

        # Store the length of the current chunk
        chunk_lengths.append(len(current_chunk))

        i += adjusted_chunk_size - overlap

    min_chunk_size = target_chunk_size // 2
    max_chunk_size = int(target_chunk_size * 1.2)
    chunks = combine_small_chunks(chunks, min_chunk_size, max_chunk_size)

    chunks = split_large_chunks(chunks, target_chunk_size)

    chunk_warning = False
    for chunk in chunks:
        if len(chunk["words"]) < 30:
            logger.warning(
                f"Chunk length is less than 30 words. Length = {len(chunk['words'])}, Start time = {chunk['start']:.2f}s"
            )
            logger.warning(
                f"Transcription Chunk: Length = {len(chunk['words'])}, Start time = {chunk['start']:.2f}s, Word count = {len(chunk['words'])}, Text = {' '.join([word['word'] for word in chunk['words'][:5]])}..."
                + (" *****" if len(chunk["words"]) < 15 else "")
            )
            chunk_warning = True

    if chunk_warning:
        logger.warning("Full list of chunks:")
        for idx, chunk in enumerate(chunks):
            logger.warning(f"Chunk {idx + 1}:")
            logger.warning(f"Text: {chunk['text']}")
            logger.warning(f"Number of words: {len(chunk['words'])}")
            logger.warning("\n")

    return chunks


def split_large_chunks(chunks, target_size):
    new_chunks = []
    for chunk in chunks:
        if len(chunk["words"]) > target_size * 1.5:
            # Split the chunk into smaller chunks
            words = chunk["words"]
            num_words = len(words)
            num_chunks = (num_words + target_size - 1) // target_size
            chunk_size = (num_words + num_chunks - 1) // num_chunks

            for i in range(0, num_words, chunk_size):
                end_index = min(i + chunk_size, num_words)
                new_chunk = {
                    "text": " ".join([w["word"] for w in words[i:end_index]]),
                    "start": words[i]["start"],
                    "end": words[end_index - 1]["end"],
                    "words": words[i:end_index],
                }
                new_chunks.append(new_chunk)
        else:
            new_chunks.append(chunk)

    return new_chunks


def save_youtube_transcription(youtube_data, file_path, transcripts):
    save_transcription(file_path, transcripts)
    file_hash = get_file_hash(file_path)
    youtube_data_map = load_youtube_data_map()
    
    # Get media metadata and store it in youtube_data
    try:
        title, author, duration, url = get_media_metadata(file_path)
        youtube_data["media_metadata"] = {
            "title": title,
            "author": author,
            "duration": duration,
            "url": url
        }
    except Exception as e:
        logger.warning(f"Failed to get media metadata for YouTube video: {e}")
    
    youtube_data["file_hash"] = file_hash
    youtube_data["file_size"] = youtube_data.get("file_size", os.path.getsize(file_path))
    youtube_data_map[youtube_data["youtube_id"]] = youtube_data
    save_youtube_data_map(youtube_data_map)