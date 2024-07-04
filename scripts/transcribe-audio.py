import hashlib
import json
import sys
import os
import getopt
import time
from openai import OpenAI, APIError, APITimeoutError
from pydub import AudioSegment
from pydub.silence import split_on_silence
from tqdm import tqdm
import tempfile
import sqlite3
import gzip
from dotenv import load_dotenv
from pinecone import Pinecone

os.environ["TOKENIZERS_PARALLELISM"] = "false"

TRANSCRIPTIONS_DB_PATH = '../audio/transcriptions.db'
TRANSCRIPTIONS_DIR = '../audio/transcriptions'

# Process transcription into overlapping chunks with time codes
def process_transcription(transcript, chunk_size=150, overlap=75):
    chunks = []
    words = transcript['words']
    i = 0
    
    while i < len(words):
        current_chunk = words[i:i + chunk_size]
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
        
        i += chunk_size - overlap
    
    return chunks

def split_audio(file_path, min_silence_len=800, silence_thresh=-28, chunk_length_ms=120000):
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
    
    return combined_chunks

def transcribe_chunk(client, chunk, previous_transcript=None, cumulative_time=0):
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
            print(f"Warning: 'words' not found in transcript. Full response: {transcript_dict}")
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
        print("OpenAI API request timed out. Skipping this chunk.")
        return None
    except APIError as e:
        print(f"OpenAI API error: {e}")
        return None
    except Exception as e:
        print(f"Error transcribing chunk. Exception type: {type(e).__name__}, Arguments: {e.args}, Full exception: {e}")
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
    file_hash = hashlib.md5(open(file_path, 'rb').read()).hexdigest()
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
    file_hash = hashlib.md5(open(file_path, 'rb').read()).hexdigest()
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

def transcribe_audio(file_path, force=False):
    """
    Transcribe audio file, using existing transcription if available and not forced.
    
    This function first checks for an existing transcription using the hybrid storage system.
    If not found or if force is True, it performs the transcription and saves the result.
    """
    existing_transcription = get_transcription(file_path)
    if existing_transcription and not force:
        return existing_transcription

    client = OpenAI()
    print("Splitting audio into chunks...")
    chunks = list(tqdm(split_audio(file_path), desc="Splitting audio", unit="chunk"))
    print(f"Audio split into {len(chunks)} chunks")
    transcripts = []
    previous_transcript = None
    cumulative_time = 0
    
    for i, chunk in enumerate(tqdm(chunks, desc="Transcribing chunks", unit="chunk")):
        transcript = transcribe_chunk(client, chunk, previous_transcript, cumulative_time)
        if transcript:
            transcripts.append(transcript)
            previous_transcript = transcript['text']
            cumulative_time += chunk.duration_seconds
        else:
            print(f"Empty or invalid transcript for chunk {i+1}")
    
    print(f"Total transcripts: {len(transcripts)}")
    if transcripts:
        save_transcription(file_path, transcripts)
    else:
        print(f"No transcripts generated for {file_path}")
    return transcripts

def create_embeddings(chunks, client):
    texts = [chunk['text'] for chunk in chunks]
    response = client.embeddings.create(input=texts, model="text-embedding-ada-002")
    return [embedding.embedding for embedding in response.data]

def load_pinecone(index_name):
    if index_name not in pc.list_indexes().names():
        pc.create_index(index_name, dimension=1536, metric="cosine")
    return pc.Index(index_name)

def store_in_pinecone(index, chunks, embeddings, file_path):
    file_name = os.path.basename(file_path)
    file_hash = hashlib.md5(open(file_path, 'rb').read()).hexdigest()
    
    vectors = []
    for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        title = file_name.replace(' ', '_').replace('.', '_').replace('-', '_')[:40]
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
                'library': "Treasures"
            }
        })

    try:
        index.upsert(vectors=vectors)
    except Exception as e:
        print(f"Error in upserting vectors: {e}")

def is_file_transcribed(index, file_path):
    file_hash = hashlib.md5(open(file_path, 'rb').read()).hexdigest()
    results = index.fetch([f"{file_hash}_chunk_0"])
    return len(results['vectors']) > 0

def query_similar_chunks(index, client, query, n_results=8):
    response = client.embeddings.create(input=[query], model="text-embedding-ada-002")
    query_embedding = response.data[0].embedding
    results = index.query(
        vector=query_embedding,
        top_k=n_results,
        include_metadata=True,
        filter={"library": "Treasures"}  
    )

    for i, match in enumerate(results['matches']):
        print(f"Chunk {i + 1}:")
        print(f"Text: {match['metadata'].get('text', 'N/A')}")
        start_time = match['metadata'].get('start_time', 0)
        end_time = match['metadata'].get('end_time', 0)
        start_time_formatted = f"{int(start_time // 3600):02}:{int((start_time % 3600) // 60):02}:{int(start_time % 60):02}"
        end_time_formatted = f"{int(end_time // 3600):02}:{int((end_time % 3600) // 60):02}:{int(end_time % 60):02}"
        print(f"File name: {match['metadata'].get('file_name', 'N/A')}")
        print(f"Start time: {start_time_formatted}")
        print(f"End time: {end_time_formatted}")
        print()

def clear_treasures_vectors(index):
    print("Clearing existing Treasures vectors from Pinecone...")
    try:
        for ids in index.list(prefix='audio||Treasures||'):
            index.delete(ids=ids)
        print("Existing Treasures vectors cleared.")
    except Exception as e:
        print(f"Error clearing Treasures vectors: {e}")

def process_file(file_path, index, report, client, force=False):
    existing_transcription = get_transcription(file_path)
    if existing_transcription and not force:
        print(f"\nUsing existing transcription for {file_path}")
        transcripts = existing_transcription
        report['skipped'] += 1
    else:
        print(f"\nTranscribing audio for {file_path}")
        try:
            transcripts = transcribe_audio(file_path, force)
            if transcripts:
                report['processed'] += 1
            else:
                print(f"No transcription data generated for {file_path}")
                report['errors'] += 1
                return
        except Exception as e:
            print(f"Error transcribing file {file_path}: {e}")
            report['errors'] += 1
            return

    try:
        for i, transcript in tqdm(enumerate(transcripts), total=len(transcripts), desc="Processing transcripts"):
            chunks = process_transcription(transcript)
            embeddings = create_embeddings(chunks, client)
            store_in_pinecone(index, chunks, embeddings, file_path)
    except Exception as e:
        print(f"Error processing file {file_path}: {e}")
        report['errors'] += 1

def process_directory(directory_path, index, client, force=False):
    report = {'processed': 0, 'skipped': 0, 'errors': 0}
    for root, dirs, files in os.walk(directory_path):
        for file in files:
            if file.lower().endswith(('.mp3', '.wav', '.flac')):
                file_path = os.path.join(root, file)
                process_file(file_path, index, report, client, force)
    print(f"\nReport:\nFiles processed: {report['processed']}\nFiles skipped: {report['skipped']}\nFiles with errors: {report['errors']}")

if __name__ == "__main__":
    def usage():
        print("Usage: python transcribe-audio.py -f <file_path> [-q <query>] [-t] [--force] [-c]")
        print("  -f, --file: Path to audio file or directory")
        print("  -q, --query: Query for similar chunks")
        print("  -t, --transcribe-only: Only transcribe the audio, don't process or store in Chroma")
        print("  --force: Force re-transcription even if a transcription already exists")
        print("  -c, --clear: Clear existing Treasures vectors from Pinecone before processing")
        sys.exit(1)

    try:
        opts, args = getopt.getopt(sys.argv[1:], "f:q:tc", ["file=", "query=", "transcribe-only", "force", "clear"])
    except getopt.GetoptError as err:
        print(err)
        usage()

    file_path = None
    query = None
    transcribe_only = False
    force_transcribe = False
    clear_vectors = False

    for opt, arg in opts:
        if opt in ("-f", "--file"):
            file_path = arg
        elif opt in ("-q", "--query"):
            query = arg
        elif opt in ("-t", "--transcribe-only"):
            transcribe_only = True
        elif opt == "--force":
            force_transcribe = True
        elif opt in ("-c", "--clear"):
            clear_vectors = True

    if not file_path and not query:
        usage()
    try:
        # Load environment variables
        load_dotenv('../.env')

        # Initialize OpenAI client
        client = OpenAI()

        # Initialize Pinecone
        pc = Pinecone(api_key=os.getenv('PINECONE_API_KEY'))

        index = load_pinecone(os.getenv('PINECONE_INDEX_NAME'))

        if clear_vectors:
            clear_treasures_vectors(index)

        init_db()  # Initialize the SQLite database for transcription indexing

        if file_path:
            if os.path.isdir(file_path):
                if transcribe_only:
                    for root, dirs, files in os.walk(file_path):
                        for file in files:
                            if file.lower().endswith(('.mp3', '.wav', '.flac')):
                                file_path = os.path.join(root, file)
                                print(f"\nTranscribing {file_path}")
                                transcribe_audio(file_path, force_transcribe)
                else:
                    process_directory(file_path, index, client, force_transcribe)
            else:
                if transcribe_only:
                    print(f"\nTranscribing {file_path}")
                    transcribe_audio(file_path, force_transcribe)
                else:
                    report = {'processed': 0, 'skipped': 0, 'errors': 0}
                    process_file(file_path, index, report, client, force_transcribe)
                    print(f"\nReport:\nFiles processed: {report['processed']}\nFiles skipped: {report['skipped']}\nFiles with errors: {report['errors']}")
        else:
            print("Skipping transcription as no file path is provided")
        
        if query and not transcribe_only:
            print("\nQuerying similar chunks:\n")
            query_similar_chunks(index, client, query)
        elif not transcribe_only:
            print("No query provided. Exiting.")

    except KeyboardInterrupt:
        print("\nKeyboard interrupt. Exiting.")
        sys.exit(0)

