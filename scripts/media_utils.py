import os
import hashlib
from mutagen.mp3 import MP3
from mutagen.id3 import ID3NoHeaderError
from pydub import AudioSegment
from pydub.silence import split_on_silence
import logging

logger = logging.getLogger(__name__)


def get_media_metadata(file_path):
    try:
        audio = MP3(file_path)
        if audio.tags:
            title = audio.tags.get(
                "TIT2", [os.path.splitext(os.path.basename(file_path))[0]]
            )[0]
            author = audio.tags.get("TPE1", ["Unknown"])[0]
            url = audio.tags.get("COMM:url:eng")
            url = url.text[0] if url else None
        else:
            title = os.path.splitext(os.path.basename(file_path))[0]
            author = "Unknown"
            url = None
        duration = audio.info.length
        return title, author, duration, url
    except ID3NoHeaderError:
        logger.warning(f"Warning: No ID3 header found for {file_path}")
        raise
    except FileNotFoundError as e:
        logger.error(f"Error reading MP3 metadata for {file_path}: {e}")
        raise
    except Exception as e:
        logger.error(f"Error reading MP3 metadata for {file_path}: {e}")
        raise


def get_file_hash(file_path):
    """Calculate MD5 hash of file content."""
    hasher = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def split_audio(
    file_path, min_silence_len=1000, silence_thresh=-26, chunk_length_ms=300000
):
    """Split audio file into chunks based on silence or maximum length."""
    audio = AudioSegment.from_mp3(file_path)
    chunks = split_on_silence(
        audio,
        min_silence_len=min_silence_len,
        silence_thresh=silence_thresh,
        keep_silence=True,
    )

    combined_chunks = []
    current_chunk = AudioSegment.empty()

    for chunk in chunks:
        if len(current_chunk) + len(chunk) <= chunk_length_ms:
            current_chunk += chunk
        else:
            combined_chunks.append(current_chunk)
            current_chunk = chunk

    if len(current_chunk) > 0:
        combined_chunks.append(current_chunk)

    return combined_chunks


def get_expected_chunk_count(file_path):
    """Calculate the expected number of chunks for an audio file."""
    audio = AudioSegment.from_mp3(file_path)
    total_duration_ms = len(audio)
    chunk_length_ms = 180000  # 3 minutes in milliseconds
    return -(-total_duration_ms // chunk_length_ms)  # Ceiling division


def print_chunk_statistics(chunk_lengths):
    """Print statistics about the audio chunks."""
    if not chunk_lengths:
        logger.info("No chunks to analyze.")
        return

    total_chunks = len(chunk_lengths)
    total_words = sum(chunk_lengths)
    avg_words = total_words / total_chunks
    min_words = min(chunk_lengths)
    max_words = max(chunk_lengths)

    logger.info(f"Total chunks: {total_chunks}")
    logger.info(f"Total words: {total_words}")
    logger.info(f"Average words per chunk: {avg_words:.2f}")
    logger.info(f"Minimum words in a chunk: {min_words}")
    logger.info(f"Maximum words in a chunk: {max_words}")
