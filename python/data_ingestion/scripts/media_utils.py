"""
Media Processing Utilities for Audio Ingestion Pipeline

Core functionality for handling audio file processing, metadata extraction, and chunking.
Designed to support distributed processing while maintaining content integrity.

Key Features:
- Metadata extraction from MP3/WAV files
- Content-aware audio chunking using silence detection
- Size-based chunk optimization for API limits
- Robust error handling for corrupted media

Technical Constraints:
- Max chunk size: 25MB (OpenAI API limit)
- Supported formats: MP3, WAV
- Minimum silence length: 1000ms
- Silence threshold: -32 dBFS
"""

import os
import hashlib
from mutagen.mp3 import MP3
from mutagen.id3 import ID3NoHeaderError
from pydub import AudioSegment
from pydub.silence import split_on_silence
import logging
import wave

logger = logging.getLogger(__name__)


def get_media_metadata(file_path):
    """
    Routes metadata extraction based on file type.
    Centralizes error handling for all media types.
    
    Raises: ValueError for unsupported formats
    """
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
    """
    Extracts MP3 metadata with fallbacks for missing tags.
    
    ID3 Tag Priority:
    1. Embedded metadata
    2. Filename-based defaults
    3. Generic placeholders
    
    Returns: (title, author, duration, url, album)
    """
    try:
        audio = MP3(file_path)
        if audio.tags:
            # Extract with fallbacks for missing tags
            title = audio.tags.get(
                "TIT2", [os.path.splitext(os.path.basename(file_path))[0]]
            )[0]
            author = audio.tags.get("TPE1", ["Unknown"])[0]
            url = audio.tags.get("COMM:url:eng")
            url = url.text[0] if url else None
            album = audio.tags.get("TALB", [None])[0]
        else:
            # Fallback to filename-based metadata
            title = os.path.splitext(os.path.basename(file_path))[0]
            author = "Unknown"
            url = None
            album = None
        duration = audio.info.length
        return title, author, duration, url, album
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
    """
    Extracts WAV metadata from header.
    Limited metadata available compared to MP3.
    
    Note: WAV format doesn't support rich metadata tags
    Returns basic info with placeholders
    """
    try:
        with wave.open(file_path, 'rb') as wav_file:
            params = wav_file.getparams()
            duration = params.nframes / params.framerate
            title = os.path.splitext(os.path.basename(file_path))[0]
            return title, "Unknown", duration, None, None 
    except Exception as e:
        logger.error(f"Error reading WAV metadata for {file_path}: {e}")
        raise


def get_file_hash(file_path):
    """
    Generates content-based file identifier.
    Uses chunked reading for memory efficiency.
    
    Chunk Size: 4KB balances memory usage vs. I/O operations
    """
    hasher = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def split_chunk_by_duration(chunk, max_duration_ms):
    """
    Splits audio chunk into fixed-duration segments.
    Used when silence-based splitting isn't optimal.
    
    Trade-offs:
    - May cut mid-speech
    - Guarantees maximum duration
    - More predictable processing times
    """
    sub_chunks = []
    for start_ms in range(0, len(chunk), max_duration_ms):
        end_ms = min(start_ms + max_duration_ms, len(chunk))
        sub_chunks.append(chunk[start_ms:end_ms])
    return sub_chunks


def calculate_max_duration_ms(chunk, max_size_bytes):
    """
    Determines maximum duration based on audio properties.
    
    Formula: max_duration = max_size / (bytes_per_ms)
    Accounts for:
    - Bit rate
    - Sample rate
    - Channels
    """
    bytes_per_ms = len(chunk.raw_data) / len(chunk)
    return int(max_size_bytes / bytes_per_ms)


def split_chunk_evenly(chunk, max_chunk_size):
    """
    Divides audio into equal-sized chunks.
    
    Strategy:
    1. Calculate optimal chunk count based on size
    2. Split into equal durations
    3. Adjust final chunk to handle remainder
    
    Note: Preferred over duration-based splitting for better size control
    """
    total_size = len(chunk.raw_data)
    num_chunks = -(-total_size // max_chunk_size)  # Ceiling division
    chunk_duration = len(chunk) / num_chunks
    
    sub_chunks = []
    for i in range(num_chunks):
        start_ms = int(i * chunk_duration)
        end_ms = int((i + 1) * chunk_duration) if i < num_chunks - 1 else len(chunk)
        sub_chunks.append(chunk[start_ms:end_ms])
    
    return sub_chunks


def split_audio(file_path):
    """
    Intelligent audio chunking system.
    
    Processing Pipeline:
    1. Initial silence-based splitting
    2. Chunk combination for size optimization
    3. Sub-splitting of large chunks
    4. Small chunk merging for efficiency
    
    Optimization Goals:
    - Minimize transcription costs
    - Preserve speech boundaries
    - Maintain processing efficiency
    - Stay under API limits
    
    Size Constraints:
    - Target: 22.5MB (90% of 25MB limit)
    - Minimum: ~5.6MB (25% of target)
    """
    min_silence_len = 1000  # Minimum silence duration for splitting
    silence_thresh = -32    # dB threshold for silence detection
    max_chunk_size = int(25 * 1024 * 1024 * 0.9)  # ~22.5MB target
    openai_limit = 25 * 1024 * 1024  # Hard limit

    logger.debug(f"Starting split_audio for file: {file_path}")
    
    # Load audio with format detection
    file_extension = os.path.splitext(file_path)[1].lower()
    if file_extension == '.mp3':
        audio = AudioSegment.from_mp3(file_path)
    elif file_extension == '.wav':
        audio = AudioSegment.from_wav(file_path)
    else:
        raise ValueError(f"Unsupported file format: {file_extension}")
    
    logger.debug(f"Audio duration: {len(audio)} ms")

    # Phase 1: Initial silence-based splitting
    chunks = split_on_silence(
        audio,
        min_silence_len=min_silence_len,
        silence_thresh=silence_thresh,
        keep_silence=True,  # Preserves context around speech
    )

    logger.debug(f"Initial number of chunks: {len(chunks)}")

    # Phase 2: Optimize chunk sizes through combination
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

    logger.debug(f"Number of combined chunks before merging small chunks: {len(combined_chunks)}")

    # Phase 3: Merge small chunks for efficiency
    changes_made = True
    max_iterations = 1000  # Prevent infinite loops
    iteration_count = 0

    while changes_made and iteration_count < max_iterations:
        changes_made = False
        i = 0
        while i < len(combined_chunks):
            # Small chunk detection (< 25% of max size)
            if len(combined_chunks[i].raw_data) < max_chunk_size / 4:
                logger.debug(f"Chunk {i+1} is smaller than the threshold. Attempting to combine.")
                
                # Try merging with previous chunk first
                if i > 0:
                    if len(combined_chunks[i-1].raw_data) + len(combined_chunks[i].raw_data) <= max_chunk_size:
                        logger.debug(f"Combining chunk {i+1} with previous chunk {i}")
                        combined_chunks[i-1] += combined_chunks[i]
                        combined_chunks.pop(i)
                        changes_made = True
                    else:
                        logger.debug(f"Cannot combine chunk {i+1} with previous chunk {i} due to size limit.")
                        i += 1
                # If no previous chunk or merge failed, try next chunk
                elif i < len(combined_chunks) - 1:
                    if len(combined_chunks[i].raw_data) + len(combined_chunks[i+1].raw_data) <= max_chunk_size:
                        logger.debug(f"Combining chunk {i+1} with next chunk {i+2}")
                        combined_chunks[i] += combined_chunks[i+1]
                        combined_chunks.pop(i+1)
                        changes_made = True
                    else:
                        logger.debug(f"Cannot combine chunk {i+1} with next chunk {i+2} due to size limit.")
                        i += 1
                else:
                    i += 1
            else:
                i += 1
        iteration_count += 1

    if iteration_count >= max_iterations:
        logger.error("Reached maximum iteration limit while combining chunks. Possible infinite loop detected.")

    logger.debug(f"Number of combined chunks after merging small chunks: {len(combined_chunks)}")

    logger.debug(f"Chunk sizes for file {file_path}:")
    for i, chunk in enumerate(combined_chunks):
        chunk_size = len(chunk.raw_data)
        logger.debug(f"Chunk {i+1} size: {chunk_size / (1024 * 1024):.2f} MB")

    # Phase 4: Handle oversized chunks and final validation
    final_chunks = []
    logger.debug(f"Processing {len(combined_chunks)} combined chunks")
    for i, chunk in enumerate(combined_chunks):
        chunk_size = len(chunk.raw_data)
        if chunk_size > max_chunk_size:
            # Oversized chunk detected - force split regardless of content
            logger.debug(f"Chunk {i+1}, size {chunk_size / (1024 * 1024):.2f} MB, exceeds max size. Splitting into sub-chunks.")
            sub_chunks = split_chunk_evenly(chunk, max_chunk_size)
            logger.debug(f"Created {len(sub_chunks)} sub-chunks for chunk {i+1}:")
            for j, sub_chunk in enumerate(sub_chunks):
                sub_chunk_size = len(sub_chunk.raw_data)
                logger.debug(f"Sub-chunk {j+1}, size: {sub_chunk_size / (1024 * 1024):.2f} MB, duration: {len(sub_chunk) / 1000:.2f} seconds")
            final_chunks.extend(sub_chunks)
        else:
            logger.debug(f"Adding chunk {i+1} to final chunks without splitting")
            final_chunks.append(chunk)
    
    logger.debug(f"Final chunk count: {len(final_chunks)}")

    # Final validation against OpenAI hard limit
    for i, chunk in enumerate(final_chunks):
        chunk_size = len(chunk.raw_data)
        if chunk_size > openai_limit:
            logger.warning(f"Chunk {i+1} exceeds OpenAI limit: {chunk_size / (1024 * 1024):.2f} MB")

    return final_chunks


def get_expected_chunk_count(file_path):
    """
    Estimates chunk count for capacity planning.
    
    Estimation Strategy:
    - Uses 3-minute chunks as baseline
    - Accounts for silence-based splits
    - Provides upper bound for resource allocation
    
    Note: Actual count may be lower due to chunk merging
    """
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
    """
    Analytics for chunk distribution quality.
    
    Metrics:
    - Total chunks: Overall processing units
    - Total words: Content volume
    - Avg words/chunk: Processing efficiency
    - Min/Max words: Content distribution
    
    Use Cases:
    - Quality assurance
    - Performance optimization
    - Resource planning
    """
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