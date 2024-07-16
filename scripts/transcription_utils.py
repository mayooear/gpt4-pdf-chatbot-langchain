import os
import tempfile
import sqlite3
import gzip
import json
import time
from openai import OpenAI, APIError, APITimeoutError
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from tqdm import tqdm
from audio_utils import get_file_hash, split_audio
import logging

logger = logging.getLogger(__name__)

TRANSCRIPTIONS_DB_PATH = '../audio/transcriptions.db'
TRANSCRIPTIONS_DIR = '../audio/transcriptions'

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
    reraise=False
)
def transcribe_chunk(client, chunk, previous_transcript=None, cumulative_time=0, file_name=""):
    try:
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as temp_file:
            chunk.export(temp_file.name, format="mp3")
            
            transcription_options = {
                "file": open(temp_file.name, "rb"),
                "model": "whisper-1",
                "response_format": "verbose_json",
                "timestamp_granularities": ["word"]
            }
            
            if previous_transcript:
                transcription_options["prompt"] = previous_transcript
            
            transcript = client.audio.transcriptions.create(**transcription_options)
        
        os.unlink(temp_file.name)
        transcript_dict = transcript.model_dump()
        
        if 'words' not in transcript_dict:
            print(f"\n*** ERROR *** 'words' not found in transcript. Full response: {transcript_dict}")
            return None
        
        # Adjust timestamps for words
        for word in transcript_dict['words']:
            word['start'] += cumulative_time
            word['end'] += cumulative_time
        
        # Create a simplified structure similar to the old 'segments' format
        simplified_transcript = {
            'text': transcript_dict['text'],
            'words': transcript_dict['words']
        }
        
        return simplified_transcript
    except APITimeoutError:
        print(f"\n*** ERROR *** OpenAI API request timed out for file {file_name}. Retrying...")
        raise
    except APIError as e:
        if e.code == 429:
            print(f"\n*** ERROR *** OpenAI API error for file {file_name}: {e}. Rate limit exceeded.")
            raise RateLimitError("Rate limit exceeded")
        elif e.code == 400 and 'The audio file could not be decoded or its format is not supported.' in str(e):
            print(f"\n*** ERROR *** OpenAI API error for file {file_name}: {e}. The audio file could not be decoded or its format is not supported. Skipping this chunk.")
            raise UnsupportedAudioFormatError(f"Unsupported audio format for file {file_name}")
        print(f"\n*** ERROR *** OpenAI API error for file {file_name}: {e}")
        raise
    except Exception as e:
        print(f"\n*** ERROR *** Error transcribing chunk for file {file_name}. Exception type: {type(e).__name__}, Arguments: {e.args}, Full exception: {e}")
        print(f"Full response: {transcript_dict if 'transcript_dict' in locals() else 'Not available'}")
        return None

def init_db():
    """Initialize SQLite database for transcription indexing."""
    conn = sqlite3.connect(TRANSCRIPTIONS_DB_PATH)
    c = conn.cursor()
    
    # Check if the table already exists
    c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='transcriptions'")
    if not c.fetchone():
        response = input("Warning: sqlite 'transcriptions' table does not exist. Do you want to create a new table? (yes/no): ")
        if response.lower() == 'yes':
            c.execute('''CREATE TABLE IF NOT EXISTS transcriptions
                         (file_hash TEXT PRIMARY KEY, file_path TEXT, timestamp REAL, json_file TEXT)''')
        else:
            print("Table creation aborted.")
            conn.close()
            return
    
    conn.commit()
    conn.close()

def get_transcription(file_path):
    """
    Retrieve transcription for a given file.
    
    This function uses a hybrid approach:
    1. It checks the SQLite database for the file's index entry.
    2. If found, it loads the transcription from the corresponding gzipped JSON file.
    """
    file_hash = get_file_hash(file_path)
    conn = sqlite3.connect(TRANSCRIPTIONS_DB_PATH)
    c = conn.cursor()
    c.execute("SELECT json_file FROM transcriptions WHERE file_hash = ?", (file_hash,))
    result = c.fetchone()
    conn.close()
    
    if result:
        json_file = result[0]
        print(f"Using existing transcription for {file_path} ({file_hash})")

        # Ensure we're using the full path to the JSON file
        full_json_path = os.path.join(TRANSCRIPTIONS_DIR, json_file)
        if os.path.exists(full_json_path):
            # Load the transcription from the gzipped JSON file
            with gzip.open(full_json_path, 'rt', encoding='utf-8') as f:
                data = json.load(f)
                return data
        else:
            print(f"Warning: JSON file not found at {full_json_path}")
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
    transcription_path = os.path.join(TRANSCRIPTIONS_DIR, f"{file_hash}.json.gz")
    
    # Save the transcription data as a gzipped JSON file
    with gzip.open(full_json_path, 'wt', encoding='utf-8') as f:
        json.dump(transcripts, f, ensure_ascii=False, indent=2)
    
    # Update the SQLite database with the file's metadata and transcription location
    conn = sqlite3.connect(TRANSCRIPTIONS_DB_PATH)
    c = conn.cursor()
    c.execute("INSERT OR REPLACE INTO transcriptions (file_hash, file_path, timestamp, json_file) VALUES (?, ?, ?, ?)",
              (file_hash, file_path, time.time(), json_file))
    conn.commit()
    conn.close()

def transcribe_audio(file_path, force=False, current_file=None, total_files=None, interrupt_event=None):
    """
    Transcribe audio file, using existing transcription if available and not forced.
    
    This function first checks for an existing transcription using the hybrid storage system.
    If not found or if force is True, it performs the transcription and saves the result.
    """
    file_name = os.path.basename(file_path)
    file_info = f" (file #{current_file} of {total_files}, {current_file/total_files:.1%})" if current_file and total_files else ""
    existing_transcription = get_transcription(file_path)
    if existing_transcription and not force:
        print(f"Using existing transcription for {file_name}{file_info}")
        return existing_transcription

    client = OpenAI()
    print(f"Splitting audio into chunks for {file_name}...{file_info}")
    chunks = split_audio(file_path)
    print(f"Audio split into {len(chunks)} chunks for {file_name}")
    transcripts = []
    previous_transcript = None
    cumulative_time = 0
    
    for i, chunk in enumerate(tqdm(chunks, desc=f"Transcribing chunks for {file_name}", unit="chunk")):
        if interrupt_event and interrupt_event.is_set():
            print("Interrupt detected. Stopping transcription...")
            return None
        try:
            transcript = transcribe_chunk(client, chunk, previous_transcript, cumulative_time, file_name)
            if transcript:
                transcripts.append(transcript)
                previous_transcript = transcript['text']
                cumulative_time += chunk.duration_seconds
            else:
                print(f"\n*** ERROR *** Empty or invalid transcript for chunk {i+1} in {file_name}")
        except RateLimitError:
            print(f"\n*** ERROR *** Rate limit exceeded. Terminating process.")
            return None
        except UnsupportedAudioFormatError as e:
            print(f"\n*** ERROR *** {e}. Stopping processing for file {file_name}.")
            return None
        except Exception as e:
            print(f"\n*** ERROR *** Error transcribing chunk for file {file_name}. Exception type: {type(e).__name__}, Arguments: {e.args}, Full exception: {e}")
            return None
    
    if transcripts:
        save_transcription(file_path, transcripts)
        return transcripts
    else:
        error_msg = f"No transcripts generated for {file_name}"
        print(f"\n*** ERROR *** {error_msg}")
        return None

def combine_small_chunks(chunks, min_chunk_size, max_chunk_size):
    i = 0
    combined = False
    while i < len(chunks) - 1:
        current_chunk = chunks[i]
        next_chunk = chunks[i + 1]
        
        if len(current_chunk['words']) < min_chunk_size or len(next_chunk['words']) < min_chunk_size:
            if len(current_chunk['words']) + len(next_chunk['words']) <= max_chunk_size:
                # Combine chunks
                time_offset = current_chunk['end'] - next_chunk['start']
                for word in next_chunk['words']:
                    word['start'] += time_offset
                    word['end'] += time_offset
                current_chunk['text'] += " " + next_chunk['text']
                current_chunk['end'] = next_chunk['end']
                current_chunk['words'].extend(next_chunk['words'])
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

def process_transcription(transcript, target_chunk_size=150, overlap=75):
    global chunk_lengths  # Ensure we are using the global list
    adjusted_target_chunk_size = int(target_chunk_size * 1.8)
    chunks = []
    words = transcript['words']
    total_words = len(words)
    
    # Calculate the number of chunks needed
    num_chunks = (total_words + adjusted_target_chunk_size - 1) // adjusted_target_chunk_size
    
    # Adjust chunk size to ensure even distribution
    adjusted_chunk_size = (total_words + num_chunks - 1) // num_chunks
    
    i = 0
    while i < total_words:
        end_index = min(i + adjusted_chunk_size, total_words)
        current_chunk = words[i:end_index]
        if not current_chunk:
            break
        
        chunk_text = ' '.join([w['word'] for w in current_chunk])
        start_time = current_chunk[0]['start']
        end_time = current_chunk[-1]['end']
        
        chunks.append({
            'text': chunk_text,
            'start': start_time,
            'end': end_time,
            'words': current_chunk
        })
        
        # Store the length of the current chunk
        chunk_lengths.append(len(current_chunk))
        
        i += adjusted_chunk_size - overlap
    
    min_chunk_size = target_chunk_size // 2
    max_chunk_size = target_chunk_size * 2
    chunks = combine_small_chunks(chunks, min_chunk_size, max_chunk_size)
    
    for chunk in chunks:
        if len(chunk['words']) < 30:
            print(f"Transcription Chunk: Length = {len(chunk['words'])}, Start time = {chunk['start']:.2f}s, Word count = {len(chunk['words'])}, Text = {' '.join([word['word'] for word in chunk['words'][:5]])}..." + (" *****" if len(chunk['words']) < 15 else ""))
            print(f"** Warning **: Chunk length is less than 30 words. Length = {len(chunk['words'])}, Start time = {chunk['start']:.2f}s")
    
    for idx, chunk in enumerate(chunks):
        logger.debug(f"Chunk {idx + 1}:")
        logger.debug(f"Text: {chunk['text']}")
        logger.debug(f"Number of words: {len(chunk['words'])}")
        logger.debug("\n")

    return chunks