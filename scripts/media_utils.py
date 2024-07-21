import os
import hashlib
from mutagen.mp3 import MP3
from mutagen.id3 import ID3NoHeaderError
from pydub import AudioSegment
from pydub.silence import split_on_silence, detect_nonsilent
import logging
import wave

logger = logging.getLogger(__name__)


def get_media_metadata(file_path):
    file_extension = os.path.splitext(file_path)[1].lower()
    try:
        if file_extension == '.mp3':
            return get_mp3_metadata(file_path)
        elif file_extension == '.wav':
            return get_wav_metadata(file_path)
        else:
            raise ValueError(f"Unsupported file format: {file_extension}")
    except Exception as e:
        logger.error(f"Error reading audio metadata for {file_path}: {e}")
        raise

def get_mp3_metadata(file_path):
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

def get_wav_metadata(file_path):
    try:
        with wave.open(file_path, 'rb') as wav_file:
            params = wav_file.getparams()
            duration = params.nframes / params.framerate
            title = os.path.splitext(os.path.basename(file_path))[0]
            return title, "Unknown", duration, None
    except Exception as e:
        logger.error(f"Error reading WAV metadata for {file_path}: {e}")
        raise


def get_file_hash(file_path):
    """Calculate MD5 hash of file content."""
    hasher = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hasher.update(chunk)
    return hasher.hexdigest()

def split_audio(
    file_path, min_silence_len=1000, silence_thresh=-32, max_chunk_size=25 * 1024 * 1024
):
    """Split audio file into chunks based on silence or maximum size."""
    file_extension = os.path.splitext(file_path)[1].lower()
    if file_extension == '.mp3':
        audio = AudioSegment.from_mp3(file_path)
    elif file_extension == '.wav':
        audio = AudioSegment.from_wav(file_path)
    else:
        raise ValueError(f"Unsupported file format: {file_extension}")
    
    chunks = split_on_silence(
        audio,
        min_silence_len=min_silence_len,
        silence_thresh=silence_thresh,
        keep_silence=True,
    )

    combined_chunks = []
    current_chunk = AudioSegment.empty()

    for chunk in chunks:
        if len(current_chunk.raw_data) + len(chunk.raw_data) <= max_chunk_size:
            current_chunk += chunk
        else:
            if len(current_chunk) > 0:
                combined_chunks.append(current_chunk)
            current_chunk = chunk

    # Add any remaining chunk to the combined chunks list
    if len(current_chunk) > 0:
        combined_chunks.append(current_chunk)

    # Combine short chunks with adjacent chunks
    changes_made = True
    while changes_made:
        changes_made = False
        i = 0
        while i < len(combined_chunks):
            if len(combined_chunks[i].raw_data) < max_chunk_size / 4:
                if i > 0:  # Prefer combining with the previous chunk
                    if len(combined_chunks[i-1].raw_data) + len(combined_chunks[i].raw_data) <= max_chunk_size:
                        combined_chunks[i-1] += combined_chunks[i]
                        combined_chunks.pop(i)
                        changes_made = True
                    else:
                        i += 1
                elif i < len(combined_chunks) - 1:  # If no previous chunk, combine with the next
                    if len(combined_chunks[i].raw_data) + len(combined_chunks[i+1].raw_data) <= max_chunk_size:
                        combined_chunks[i] += combined_chunks[i+1]
                        combined_chunks.pop(i+1)
                        changes_made = True
                    else:
                        i += 1
            else:
                i += 1

    # Split any chunks that are still too large
    final_chunks = []
    for chunk in combined_chunks:
        if len(chunk.raw_data) > max_chunk_size:
            sub_chunks = [chunk[i:i+max_chunk_size] for i in range(0, len(chunk), max_chunk_size)]
            final_chunks.extend(sub_chunks)
        else:
            final_chunks.append(chunk)

    logger.debug("split_audio - List of chunk sizes:")
    for i, chunk in enumerate(final_chunks):
        logger.debug(f"Chunk {i+1} size: {len(chunk.raw_data)} bytes")

    return final_chunks


def get_expected_chunk_count(file_path):
    """Calculate the expected number of chunks for an audio file."""
    file_extension = os.path.splitext(file_path)[1].lower()
    if file_extension == '.mp3':
        audio = AudioSegment.from_mp3(file_path)
    elif file_extension == '.wav':
        audio = AudioSegment.from_wav(file_path)
    else:
        raise ValueError(f"Unsupported file format: {file_extension}")

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