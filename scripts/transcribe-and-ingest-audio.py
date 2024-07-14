import sys
import os
import getopt
import time
import json
import hashlib
import tempfile
import sqlite3
import gzip
import textwrap
from datetime import date
from dotenv import load_dotenv
from tqdm import tqdm
from pydub import AudioSegment
from pydub.silence import split_on_silence
from openai import OpenAI, APIError, APITimeoutError
import openai
from pinecone import Pinecone
import multiprocessing
from functools import partial
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from progress.bar import Bar
import signal
import mutagen
from mutagen.mp3 import MP3
from mutagen.id3 import ID3NoHeaderError
from collections import defaultdict
import boto3
from botocore.exceptions import ClientError
from audio_utils import get_file_hash, get_audio_metadata
import statistics
import argparse

#os.environ["TOKENIZERS_PARALLELISM"] = "false"

TRANSCRIPTIONS_DB_PATH = '../audio/transcriptions.db'
TRANSCRIPTIONS_DIR = '../audio/transcriptions'

interrupt_requested = multiprocessing.Value('b', False)
force_exit = multiprocessing.Value('b', False)

question = "question"
excerpts = "excerpts"

PROMPT = f"""
You are an expert research system. Use the following pieces of context to answer the question at the end.

# General guidelines

If you don't know the answer, DO NOT try to make up an answer. Say you don't know, and 
inform them that you are only answering using the part of the Ananda Library authored    by Swami and Master. Tell them they can use the dropdown menu at the bottom of the page to   change the context to "Whole library" and then you will have access to additional Ananda Library content.

If the question is not related to the context or chat history, politely respond that you are tuned to
only answer questions that are related to the context.
IMPORTANT: DO NOT use any information you know about the world.
Do not mention the source, author, or title.
Today's date is {date.today().strftime("%Y-%m-%d")}.

# Handling Personal Queries

In response to questions that suggest or imply personal communications, such as "Did [historical figure] tell you...?", explicitly clarify your role as an AI:
Example: "As an AI, I have not personally communicated with anyone. It is documented that [historical figure] described or wrote that..."
This ensures clarity and maintains an impersonal tone in the appropriate contexts.

# Direct Informational Responses

For general informational queries that do not imply personal interaction, provide the information directly, omitting any impersonal disclaimer:
Example: "According to documented teachings, [historical figure] stated that..."

# Names

Refer to Paramhansa Yogananda and Swami Yogananda as Master.
DO NOT call Master "the Master" or "Master Yogananda".
Refer to Swami Kriyananda as Swamiji.
Master = Paramhansa Yogananda
Swami = Swami Kriyananda
Swamiji = Swami
A reference to Swami is always to Swami Kriyananda unless it specifies another Swami.
Swami Sri Yukteswar is Yogananda's guru.
Lahiri Mahasaya is Sri Yukteswar's guru.
Babaji Krishnan is Lahiri Mahasaya's guru.
AY or The AY = Autobiography of a Yogi book

# Content

The context is Ananda Library, which has Master and Swami's teachings. Say "Master and Swami's teachings" or "the teachings", NOT "the context" or "the content provided in the context". If the context is only from Master or only Swami, just say Master's teachings or Swami's teachings. Don't say "Swami's teachings, as reflected in Master and Swami's teachings". Just say "Swami's teachings" if it's from him.

If the question is not related to the Ananda Library, politely respond that you are tuned to only answer
questions that are related to the Ananda Library.
The Autobiography of a Yogi is Yogananda's seminal work and the library includes it in its entirety. Answer
any questions about it.
Never list a source as generically "Ananda Library" - not helpful.
If the question is for someone's email address or affiliation information, politely respond that
the email list can be found at: https://www.anandalibrary.org/email-list/.

# Format

Format beautifully in plain text for display in a terminal window.
Leave a blank line between paragraphs.

# Context

You *MUST* give several direct quotes, but do not quote more than 12 words from any one excerpt (chunk). 
Do not put your answer in a single paragraph.

Your answer will refer to the audio to hear more, e.g.:

## Example Question

dealing with very tough health karma

## Example Answer

Handling tough health karma involves understanding various elements according to
Master and Swami's teachings.

1. Karma, particularly health karma, can often result as a correction for past
tendencies. It can work as a restraint on previous wrongful tendencies, and
sometimes, a physical problem or ailment serves as a significant part of
spiritual growth. As Swamiji illuminates, "The karmic pattern had been set up
for the correction but it needed to get down on deep enough levels of his own
mind for him to be able to understand." 
[File: Principles of Healing Part Two.mp3; Start: 00:38:27]

2. The understanding of how karma works is crucial here, as Swamiji states, "If
you act harshly if you act cruelly if you hurt people you certainly will suffer
because they are a part of you. And most people think well I'm not suffering
they're suffering. Yes, something inside you will suffer and karma will come out
in the end." 
[File: 01 Nature of True Self.mp3; Start: 00:04:00]

3. No karma is unchangeable. Persistence is the key. Even deep issues can be
overcome if one keeps trying. One should rejoice in being on the right path and
see this as the lifetime to get rid of those karmic debts. In Swamiji's words,
"All you do know for sure is that if you keep tugging away even a deep karma can
be overcome finally." 
[File: 01 How to Use Your Emotions Part1.mp3; Start: 01:08:00]

While struggling with health karma, maintaining inner calmness and positive
attitude can attract better outcomes as suggested in the teachings. Remember
Swamiji's affirmation, "You will attract the kinds of things that you expect the
world to do." 
[File: Acheiving Emotional Maturity.mp3; Start: 01:00:37]

# Excerpts

Use these transcribed excerpts from talks by Swami to form an answer to the question.

{{excerpts}}

# Question

Question: {{question}}

Helpful answer:
"""

class UnsupportedAudioFormatError(Exception):
    pass

TARGET_CHUNK_SIZE = 150

# Global list to store chunk lengths
chunk_lengths = []

# Global flag for dry run
dryrun = False

# Process transcription into overlapping chunks with time codes
def process_transcription(transcript, target_chunk_size=TARGET_CHUNK_SIZE, overlap=TARGET_CHUNK_SIZE // 2):
    global chunk_lengths  # Ensure we are using the global list
    # Increase target chunk size to try to get avg size to the target
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
        end_index = i + adjusted_chunk_size
        if end_index > total_words:
            end_index = total_words
        
        current_chunk = words[i:end_index]
        if not current_chunk: 
            break
        
        current_chunk_text = [item['word'] for item in current_chunk]
        
        chunk_text = " ".join(current_chunk_text)
        start_time = current_chunk[0]['start']
        end_time = current_chunk[-1]['end']
        
        chunks.append({
            'text': chunk_text,
            'start_time': start_time,
            'end_time': end_time,
            'words': current_chunk
        })
        
        # Store the length of the current chunk
        chunk_lengths.append(len(current_chunk))
        
        i += adjusted_chunk_size - overlap
    
    # Combine the last two chunks with the previous ones if they are too small
    if len(chunks) > 2 and len(chunks[-1]['words']) < target_chunk_size // 2:
        last_chunk = chunks.pop()
        chunks[-2]['text'] += " " + last_chunk['text']
        chunks[-2]['end_time'] = last_chunk['end_time']
        chunks[-2]['words'].extend(last_chunk['words'])
    
    if len(chunks) > 1 and len(chunks[-1]['words']) < target_chunk_size // 2:
        last_chunk = chunks.pop()
        chunks[-1]['text'] += " " + last_chunk['text']
        chunks[-1]['end_time'] = last_chunk['end_time']
        chunks[-1]['words'].extend(last_chunk['words'])
    
    for chunk in chunks:
        if len(chunk['words']) < 30:
            print(f"Transcription Chunk: Length = {len(chunk['words'])}, Start time = {chunk['start_time']:.2f}s, Word count = {len(chunk['words'])}, Text = {' '.join([word['word'] for word in chunk['words'][:5]])}..." + (" *****" if len(chunk['words']) < 15 else ""))
            print(f"** Warning **: Chunk length is less than 30 words. Length = {len(chunk['words'])}, Start time = {chunk['start_time']:.2f}s")
        
    return chunks

def print_chunk_statistics(chunk_lengths):
    if chunk_lengths:
        avg_length = statistics.mean(chunk_lengths)
        std_dev = statistics.stdev(chunk_lengths)
        min_length = min(chunk_lengths)
        max_length = max(chunk_lengths)
        print(f"\nAverage chunk length: {round(avg_length)} words")
        print(f"Standard deviation of chunk lengths: {round(std_dev)} words")
        print(f"Smallest chunk length: {min_length} words")
        print(f"Largest chunk length: {max_length} words")
    else:
        print("No chunks processed.")

def split_audio(file_path, min_silence_len=1000, silence_thresh=-26, chunk_length_ms=300000):
    audio = AudioSegment.from_file(file_path)
    chunks = split_on_silence(
        audio, 
        min_silence_len=min_silence_len,
        silence_thresh=silence_thresh,
        keep_silence=True
    )
    
    combined_chunks = []
    current_chunk = AudioSegment.empty()
    for chunk in chunks:
        if len(current_chunk) + len(chunk) < chunk_length_ms:
            current_chunk += chunk
        else:
            combined_chunks.append(current_chunk)
            current_chunk = chunk
    
    if len(current_chunk) > 0:
        combined_chunks.append(current_chunk)
    
    # Debug print to log the time windows of the chunks
    for i, chunk in enumerate(combined_chunks):
        start_time = sum(len(c) for c in combined_chunks[:i]) / 1000
        end_time = start_time + len(chunk) / 1000
        print(f"Chunk {i+1}: Start time = {start_time:.2f}s, End time = {end_time:.2f}s")
    
    return combined_chunks

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
            print(f"\n*** ERROR *** OpenAI API error for file {file_name}: {e}. Exiting script due to rate limit.")
            interrupt_requested.value = True
            return None
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
                # for rec in data:
                    # words = rec['text'].split()
                    # if len(words) > 40:
                    #     print(f"{' '.join(words[:20])} ... {' '.join(words[-20:])} -> ")
                    # else:
                    #     print(f"{rec['text']} -> ")
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

def transcribe_audio(file_path, force=False, current_file=None, total_files=None):
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
        try:
            transcript = transcribe_chunk(client, chunk, previous_transcript, cumulative_time, file_name)
            if transcript:
                transcripts.append(transcript)
                previous_transcript = transcript['text']
                cumulative_time += chunk.duration_seconds
            else:
                print(f"\n*** ERROR *** Empty or invalid transcript for chunk {i+1} in {file_name}")
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

def create_embeddings(chunks, client):
    texts = [chunk['text'] for chunk in chunks]
    response = client.embeddings.create(input=texts, model="text-embedding-ada-002")
    return [embedding.embedding for embedding in response.data]

def load_pinecone(index_name):
    if index_name not in pc.list_indexes().names():
        pc.create_index(index_name, dimension=1536, metric="cosine")
    return pc.Index(index_name)

def store_in_pinecone(index, chunks, embeddings, file_path, dryrun=False):
    if dryrun:
        return
    
    file_name = os.path.basename(file_path)
    file_hash = get_file_hash(file_path)
    
    # Get the title and author from metadata or fallback
    title, author = get_audio_metadata(file_path)
    
    vectors = []
    for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        content_hash = hashlib.md5(chunk['text'].encode()).hexdigest()[:8]
        chunk_id = f"audio||Treasures||{title}||{content_hash}||chunk{i+1}"
        
        vectors.append({
            'id': chunk_id,
            'values': embedding,
            'metadata': {
                'text': chunk['text'],
                'start_time': chunk['start_time'],
                'end_time': chunk['end_time'],
                'full_info': json.dumps(chunk),
                'file_name': file_name,
                'file_hash': file_hash,
                'library': "Treasures",
                'author': author,
                'type': 'audio',
                'title': title,
            }
        })

    try:
        index.upsert(vectors=vectors)
    except Exception as e:
        error_message = str(e)
        if "429" in error_message and "Too Many Requests" in error_message:
            print(f"Error in upserting vectors: {e}")
            print("You may have reached your write unit limit for the current month. Exiting script.")
            sys.exit(1)
        else:
            print(f"Error in upserting vectors: {e}")

def query_similar_chunks(index, client, query, n_results=8):
    response = client.embeddings.create(input=[query], model="text-embedding-ada-002")
    query_embedding = response.data[0].embedding
    results = index.query(
        vector=query_embedding,
        top_k=n_results,
        include_metadata=True,
        filter={"library": "Treasures"}  
    )

    excerpts = []
    for i, match in enumerate(results['matches']):
        text = match['metadata'].get('text', 'N/A')
        file_name = match['metadata'].get('file_name', 'N/A')
        start_time = match['metadata'].get('start_time', 0)
        end_time = match['metadata'].get('end_time', 0)
        start_time_formatted = f"{int(start_time // 3600):02}:{int((start_time % 3600) // 60):02}:{int(start_time % 60):02}"
        end_time_formatted = f"{int(end_time // 3600):02}:{int((end_time % 3600) // 60):02}:{int(end_time % 60):02}"
        
        excerpt = f"Chunk {i + 1}:\n"
        excerpt += f"Text: {text}\n"
        excerpt += f"File name: {file_name}\n"
        excerpt += f"Start time: {start_time_formatted}\n"
        excerpt += f"End time: {end_time_formatted}\n"
        excerpts.append(excerpt)

    excerpts_text = "\n\n".join(excerpts)
    
    # Prepare the prompt
    formatted_prompt = PROMPT.format(excerpts=excerpts_text, question=query)
    
    # Send to OpenAI
    response = client.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": formatted_prompt}
        ]
    )
    
    wrapped_text = "\n".join(textwrap.fill(line, width=80) for line in response.choices[0].message.content.splitlines())
    print()
    print(wrapped_text)
    print()

def clear_treasures_vectors(index):
    print("Preparing to clear existing Treasures vectors from Pinecone...")
    try:
        vector_ids = list(index.list(prefix='audio||Treasures||'))
        total_vectors = len(vector_ids)
        
        if total_vectors == 0:
            print("No existing Treasures vectors found.")
            return
        
        print(f"Found {total_vectors} vectors to clear.")
        
        # Add user confirmation
        confirmation = input(f"Are you sure you want to clear {total_vectors} Treasures vectors? (yes/no): ").lower()
        if confirmation != 'yes':
            print("Vector clearing aborted.")
            return
        
        progress_bar = Bar('Clearing vectors', max=total_vectors)
        
        for ids in vector_ids:
            index.delete(ids=ids)
            progress_bar.next()
        
        progress_bar.finish()
        print("Existing Treasures vectors cleared.")
    except Exception as e:
        print(f"Error clearing Treasures vectors: {e}")
        sys.exit(1)

def get_expected_chunk_count(file_path):
    transcripts = get_transcription(file_path)
    if not transcripts:
        return 0
    total_chunks = sum(len(transcript['words']) for transcript in transcripts)
    return (total_chunks + TARGET_CHUNK_SIZE - 1) // TARGET_CHUNK_SIZE

def is_file_fully_indexed(index, file_path):
    file_hash = get_file_hash(file_path)
    file_name = os.path.basename(file_path)
    
    expected_chunks = get_expected_chunk_count(file_path)
    if expected_chunks == 0:
        return False
    
    results = index.query(
        vector=[0] * 1536,  # Dummy vector
        top_k=expected_chunks,
        include_metadata=True,
        filter={
            "file_hash": file_hash,
            "file_name": file_name
        }
    )
    
    actual_chunks = len(results['matches'])
    
    if actual_chunks == expected_chunks:
        print(f"File fully indexed: {file_path} ({actual_chunks}/{expected_chunks} chunks)")
        return True
    else:
        if actual_chunks > 0:
            print(f"WARNING: File partially indexed: {file_path} ({actual_chunks}/{expected_chunks} chunks)")
        return False

def init_worker():
    global client, index, interrupt_requested, force_exit
    client = OpenAI()
    pc = Pinecone(api_key=os.getenv('PINECONE_API_KEY'))
    index = pc.Index(os.getenv('PINECONE_INDEX_NAME'))
    signal.signal(signal.SIGINT, signal.SIG_IGN)

def process_file_wrapper(args):
    file_path, force, current_file, total_files, dryrun = args
    if check_interrupt():
        return None
    return process_file(file_path, index, client, force, current_file, total_files, dryrun)

def process_file(file_path, index, client, force=False, current_file=None, total_files=None, dryrun=False):
    local_report = {'processed': 0, 'skipped': 0, 'errors': 0, 'error_details': [], 'warnings': [], 'partially_indexed': 0, 'fully_indexed': 0, 'chunk_lengths': []}
    file_name = os.path.basename(file_path)
    file_info = f" (file #{current_file} of {total_files}, {current_file/total_files:.1%})" if current_file and total_files else ""
    existing_transcription = get_transcription(file_path)
    if existing_transcription and not force:
        if is_file_fully_indexed(index, file_path):
            print(f"\nFile already fully transcribed and indexed: {file_name}{file_info}")
            local_report['skipped'] += 1
            local_report['fully_indexed'] += 1

            # Still attempt to upload to S3 even if skipped
            s3_warning = upload_to_s3(file_path)
            if s3_warning:
                local_report['warnings'].append(s3_warning)

            return local_report
        else:
            print(f"\nFile transcribed but not fully indexed. Re-processing: {file_name}{file_info}")
            transcripts = existing_transcription
            local_report['partially_indexed'] += 1
    else:
        print(f"\nTranscribing audio for {file_name}{file_info}")
        try:
            transcripts = transcribe_audio(file_path, force, current_file, total_files)
            if transcripts:
                local_report['processed'] += 1
            else:
                error_msg = f"Error transcribing file {file_name}: No transcripts generated"
                print(f"\n*** ERROR *** {error_msg}")
                local_report['errors'] += 1
                local_report['error_details'].append(error_msg)
                return local_report
        except Exception as e:
            error_msg = f"Error transcribing file {file_name}: {str(e)}"
            print(f"\n*** ERROR *** {error_msg}")
            local_report['errors'] += 1
            local_report['error_details'].append(error_msg)
            return local_report

    try:
        if dryrun:  
            print(f"Dry run mode: Would store chunks for file {file_path} in Pinecone.")

        for i, transcript in tqdm(enumerate(transcripts), total=len(transcripts), desc=f"Processing transcripts for {file_name}"):
            if check_interrupt():
                break
            chunks = process_transcription(transcript)
            local_report['chunk_lengths'].extend([len(chunk['words']) for chunk in chunks])
            embeddings = create_embeddings(chunks, client)
            store_in_pinecone(index, chunks, embeddings, file_path, dryrun)
        
        # After successful processing, upload to S3
        s3_warning = upload_to_s3(file_path)
        if s3_warning:
            local_report['warnings'].append(s3_warning)
    except Exception as e:
        error_msg = f"Error processing file {file_name}: {str(e)}"
        print(f"\n*** ERROR *** {error_msg}")
        local_report['errors'] += 1
        local_report['error_details'].append(error_msg)

    return local_report

def upload_to_s3(file_path):
    s3_client = boto3.client('s3',
        aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
        region_name=os.getenv('AWS_REGION')
    )
    bucket_name = os.getenv('S3_BUCKET_NAME')
    file_name = os.path.basename(file_path)
    s3_key = f'public/audio/{file_name}'

    try:
        # Check if file already exists in S3
        try:
            s3_obj = s3_client.head_object(Bucket=bucket_name, Key=s3_key)
            s3_size = s3_obj['ContentLength']
            local_size = os.path.getsize(file_path)

            if s3_size == local_size:
                print(f"File {file_name} already exists in S3 with the same size. Skipping upload.")
                return None
            else:
                warning_msg = f"WARNING: File {file_name} exists in S3 but has a different size. S3 size: {s3_size} bytes, Local size: {local_size} bytes. Skipping upload to prevent data loss. Please review and handle manually if needed."
                print(warning_msg)
                return warning_msg
        except ClientError as e:
            if e.response['Error']['Code'] == '404':
                # File doesn't exist in S3, proceed with upload
                pass
            else:
                raise

        # Upload file to S3
        s3_client.upload_file(file_path, bucket_name, s3_key)
        print(f"Successfully uploaded {file_name} to S3")
        return None
    except Exception as e:
        error_msg = f"Error uploading {file_name} to S3: {str(e)}"
        print(error_msg)
        return error_msg

def check_interrupt():
    if interrupt_requested.value:
        print("Interrupt requested. Exiting...")
        force_exit.value = True
        return True
    return False

def process_directory(directory_path, force=False, dryrun=False):
    audio_files = []
    processed_hashes = set()
    skipped_files = []

    for root, dirs, files in os.walk(directory_path):
        for file in files:
            if file.lower().endswith(('.mp3', '.wav', '.flac')):
                file_path = os.path.join(root, file)
                file_hash = get_file_hash(file_path)
                
                if file_hash in processed_hashes:
                    print(f"Skipping duplicate content: {file_path}")
                    skipped_files.append(file_path)
                    continue
                
                audio_files.append(file_path)
                processed_hashes.add(file_hash)
    
    total_files = len(audio_files)
    
    # Calculate the number of processes
    max_processes = multiprocessing.cpu_count()
    reduced_processes = max(1, int(max_processes * 0.7))  # Reduce by 30%
    num_processes = min(reduced_processes, 1)  # Cap num of processes
    
    print(f"Using {num_processes} processes for parallel processing")
    
    # Use multiprocessing to process files in parallel
    with multiprocessing.Pool(processes=num_processes, initializer=init_worker) as pool:
        try:
            args_list = [(file_path, force, i+1, total_files, dryrun) for i, file_path in enumerate(audio_files)]
            results = []
            for result in pool.imap_unordered(process_file_wrapper, args_list):
                if result is None:
                    print("Interrupt detected. Stopping processing...")
                    break
                results.append(result)
                if check_interrupt():
                    print("Interrupt requested. Finishing current files...")
                    break
        except KeyboardInterrupt:
            print("KeyboardInterrupt received. Terminating workers...")
            pool.terminate()
        finally:
            pool.close()
            pool.join()
    
    # Aggregate results from all processes
    report = {'processed': 0, 'skipped': 0, 'errors': 0, 'error_details': [], 'warnings': [], 'partially_indexed': 0, 'fully_indexed': 0, 'chunk_lengths': []}
    for result in results:
        report['processed'] += result['processed']
        report['skipped'] += result['skipped']
        report['errors'] += result['errors']
        report['error_details'].extend(result.get('error_details', []))
        report['warnings'].extend(result.get('warnings', []))
        report['partially_indexed'] += result.get('partially_indexed', 0)
        report['fully_indexed'] += result.get('fully_indexed', 0)
        report['chunk_lengths'].extend(result.get('chunk_lengths', []))
    
    # Add skipped files due to duplicate content
    report['skipped'] += len(skipped_files)
    
    print(f"\nFinal Report:")
    print(f"Files processed: {report['processed']}")
    print(f"Files skipped: {report['skipped']}")
    print(f"Files with errors: {report['errors']}")
    
    if report['errors'] > 0:
        print("\nError details:")
        for error in report['error_details']:
            print(f"- {error}")
    
    if report['warnings']:
        print("\nWarnings:")
        for warning in report['warnings']:
            print(f"- {warning}")
    
    if skipped_files:
        print("\nSkipped files due to duplicate content:")
        for file in skipped_files:
            print(f"- {file}")

    print(f"Partially indexed files: {report['partially_indexed']}")
    print(f"Fully indexed files: {report['fully_indexed']}")

    return report

def signal_handler(sig, frame):
    global interrupt_requested, force_exit
    if not interrupt_requested.value:
        print('\nCtrl+C pressed. Finishing current files and then exiting...')
        interrupt_requested.value = True
    else:
        print('\nCtrl+C pressed again. Forcing immediate exit...')
        force_exit.value = True
        sys.exit(0)

def check_unique_filenames(directory_path, s3_client, bucket_name):
    local_files = defaultdict(list)
    s3_files = set()
    conflicts = defaultdict(list)

    # Collect local files
    for root, _, files in os.walk(directory_path):
        for file in files:
            if file.lower().endswith(('.mp3', '.wav', '.flac')):
                local_files[file].append(os.path.join(root, file))

    # Collect S3 files
    try:
        paginator = s3_client.get_paginator('list_objects_v2')
        for page in paginator.paginate(Bucket=bucket_name, Prefix='public/audio/'):
            for obj in page.get('Contents', []):
                s3_files.add(os.path.basename(obj['Key']))
    except ClientError as e:
        print(f"Error accessing S3 bucket: {e}")
        return []

    # Check for conflicts with S3
    for file in local_files:
        if file in s3_files:
            conflicts[file].append(f"S3: public/audio/{file}")

    return conflicts

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Audio transcription and indexing script")
    parser.add_argument("-f", "--file", help="Path to audio file or directory")
    parser.add_argument("-q", "--query", help="Query for similar chunks")
    parser.add_argument("-t", "--transcribe-only", action="store_true", help="Only transcribe the audio, don't process or store in Chroma")
    parser.add_argument("--force", action="store_true", help="Force re-transcription even if a transcription already exists")
    parser.add_argument("-c", "--clear-treasures-vectors", action="store_true", help="Clear existing Treasures vectors from Pinecone before processing")
    parser.add_argument("--override-conflicts", action="store_true", help="Continue processing even if filename conflicts are found")
    parser.add_argument("--dryrun", action="store_true", help="Perform a dry run without sending data to Pinecone")
    
    args = parser.parse_args()

    if not args.file and not args.query:
        parser.print_help()
        sys.exit(1)

    try:
        # Load environment variables
        load_dotenv('../.env')

        # Initialize OpenAI client
        client = OpenAI()

        # Initialize Pinecone
        pc = Pinecone(api_key=os.getenv('PINECONE_API_KEY'))

        index = load_pinecone(os.getenv('PINECONE_INDEX_NAME'))

        # Check for unique filenames
        if args.file and os.path.isdir(args.file):
            s3_client = boto3.client('s3',
                aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
                aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
                region_name=os.getenv('AWS_REGION')
            )
            bucket_name = os.getenv('S3_BUCKET_NAME')
            conflicts = check_unique_filenames(args.file, s3_client, bucket_name)
            if conflicts and not args.override_conflicts:
                print("Filename conflicts found:")
                for file, locations in conflicts.items():
                    print(f"\n{file}:")
                    for location in locations:
                        print(f"  - {location}")
                print("Exiting due to filename conflicts. Use --override-conflicts to continue processing.")
                sys.exit(1)
        
        if args.clear_treasures_vectors:
            clear_treasures_vectors(index)

        init_db()  # Initialize the SQLite database for transcription indexing

        if args.file:
            if os.path.isdir(args.file):
                if args.transcribe_only:
                    for root, dirs, files in os.walk(args.file):
                        for file in files:
                            if file.lower().endswith(('.mp3', '.wav', '.flac')):
                                file_path = os.path.join(root, file)
                                print(f"\nTranscribing {file_path}")
                                transcribe_audio(file_path, args.force)
                            if check_interrupt():
                                print("Interrupt requested. Exiting...")
                                sys.exit(0)
                else:
                    report = process_directory(args.file, args.force, args.dryrun)
                    # Print chunk statistics
                    print_chunk_statistics(report['chunk_lengths'])
            else:
                if args.transcribe_only:
                    print(f"\nTranscribing {args.file}")
                    transcribe_audio(args.file, args.force)
                else:
                    # For single file processing, create client and index here
                    client = OpenAI()
                    pc = Pinecone(api_key=os.getenv('PINECONE_API_KEY'))
                    index = pc.Index(os.getenv('PINECONE_INDEX_NAME'))
                    report = process_file(args.file, index, client, args.force, dryrun=args.dryrun)
                    print(f"\nReport:")
                    print(f"Files processed: {report['processed']}")
                    print(f"Files skipped: {report['skipped']}")
                    print(f"Files with errors: {report['errors']}")
                    if report['errors'] > 0:
                        print("\nError details:")
                        for error in report['error_details']:
                            print(f"- {error}")
                    if report['warnings']:
                        print("\nWarnings:")
                        for warning in report['warnings']:
                            print(f"- {warning}")
                    # Print chunk statistics
                    print_chunk_statistics(report['chunk_lengths'])

        if args.query and not args.transcribe_only:
            query_similar_chunks(index, client, args.query)
        elif not args.file and not args.transcribe_only:
            print("No file path or query provided. Exiting.")

    except KeyboardInterrupt:
        print("\nKeyboard interrupt. Exiting.")
        sys.exit(0)

