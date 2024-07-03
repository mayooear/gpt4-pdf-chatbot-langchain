import sys
import os
import getopt
import time
from openai import OpenAI
import openai
from sentence_transformers import SentenceTransformer
import json
import hashlib
from pydub import AudioSegment
from pydub.silence import split_on_silence
from tqdm import tqdm
import tempfile
import sqlite3
import gzip
from dotenv import load_dotenv
import pinecone

os.environ["TOKENIZERS_PARALLELISM"] = "false"

# Process transcription into overlapping chunks with time codes
def process_transcription(words, chunk_size=150, overlap=75):
    chunks = []
    current_chunk = []
    current_chunk_text = []
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

def transcribe_chunk(client, chunk, previous_transcript=None):
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
        # Convert Transcription object to dictionary
        return transcript.model_dump()
    except openai.error.Timeout:
        print("OpenAI API request timed out. Skipping this chunk.")
        return None
    except Exception as e:
        print(f"Error transcribing chunk: {e}")
        return None

def init_db():
    """Initialize SQLite database for transcription indexing."""
    conn = sqlite3.connect('transcriptions.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS transcriptions
                 (file_hash TEXT PRIMARY KEY, file_path TEXT, timestamp REAL, json_file TEXT)''')
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
    conn = sqlite3.connect('transcriptions.db')
    c = conn.cursor()
    c.execute("SELECT json_file FROM transcriptions WHERE file_hash = ?", (file_hash,))
    result = c.fetchone()
    conn.close()
    
    if result:
        json_file = result[0]
        # Load the transcription from the gzipped JSON file
        with gzip.open(json_file, 'rt', encoding='utf-8') as f:
            data = json.load(f)
            for rec in data:
                words = rec['text'].split()
                if len(words) > 40:
                    print(f"{' '.join(words[:20])} ... {' '.join(words[-20:])} -> ")
                else:
                    print(f"{rec['text']} -> ")
            return data
    return None

def save_transcription(file_path, transcripts):
    """
    Save transcription using the hybrid approach:
    1. Store the raw transcription data in a gzipped JSON file.
    2. Save the file's metadata and location in the SQLite database for quick indexing.
    """
    file_hash = hashlib.md5(open(file_path, 'rb').read()).hexdigest()
    json_file = f"transcriptions/{file_hash}.json.gz"
    
    # Ensure the transcriptions directory exists
    os.makedirs("transcriptions", exist_ok=True)
    
    # Save the transcription data as a gzipped JSON file
    with gzip.open(json_file, 'wt', encoding='utf-8') as f:
        json.dump(transcripts, f, ensure_ascii=False, indent=2)
    
    # Update the SQLite database with the file's metadata and transcription location
    conn = sqlite3.connect('transcriptions.db')
    c = conn.cursor()
    c.execute("INSERT OR REPLACE INTO transcriptions (file_hash, file_path, timestamp, json_file) VALUES (?, ?, ?, ?)",
              (file_hash, file_path, time.time(), json_file))
    conn.commit()
    conn.close()

def transcribe_audio(file_path):
    """
    Transcribe audio file, using existing transcription if available.
    
    This function first checks for an existing transcription using the hybrid storage system.
    If not found, it performs the transcription and saves the result.
    """
    existing_transcription = get_transcription(file_path)
    if existing_transcription:
        print(f"Using existing transcription for {file_path}")
        return existing_transcription

    client = OpenAI()
    print("Splitting audio into chunks...")
    chunks = split_audio(file_path)
    print(f"Audio split into {len(chunks)} chunks")
    transcripts = []
    previous_transcript = None
    
    for i, chunk in enumerate(tqdm(chunks, desc="Transcribing chunks", unit="chunk")):
        # print(f"Processing chunk {i+1}/{len(chunks)}")
        transcript = transcribe_chunk(client, chunk, previous_transcript)
        if transcript:
            transcripts.append(transcript)
            previous_transcript = transcript['text']
            # print(f"Chunk {i+1} transcribed. Transcript length: {len(transcript['words'])} words")
        else:
            print(f"Empty transcript for chunk {i+1}")
    
    print(f"Total transcripts: {len(transcripts)}")
    if transcripts:
        save_transcription(file_path, transcripts)
    else:
        print(f"No transcripts generated for {file_path}")
    return transcripts

def create_embeddings(chunks):
    model = SentenceTransformer('all-MiniLM-L6-v2')
    embeddings = model.encode([chunk['text'] for chunk in chunks])
    return embeddings, model

def load_pinecone(index_name):
    if index_name not in pinecone.list_indexes():
        pinecone.create_index(index_name, dimension=1536, metric="cosine")
    return pinecone.Index(index_name)

def store_in_pinecone(index, chunks, embeddings, file_path):
    file_name = os.path.basename(file_path)
    file_hash = hashlib.md5(open(file_path, 'rb').read()).hexdigest()
    
    vectors = []
    for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        vectors.append({
            'id': f"{file_hash}_chunk_{i}",
            'values': embedding.tolist(),
            'metadata': {
                'text': chunk['text'],
                'start_time': chunk['start_time'],
                'end_time': chunk['end_time'],
                'full_info': json.dumps(chunk),
                'file_name': file_name,
                'file_hash': file_hash
            }
        })
    
    index.upsert(vectors)

def is_file_transcribed(index, file_path):
    file_hash = hashlib.md5(open(file_path, 'rb').read()).hexdigest()
    results = index.fetch([f"{file_hash}_chunk_0"])
    return len(results['vectors']) > 0

def query_similar_chunks(index, model, query, n_results=8):
    query_embedding = model.encode([query])[0].tolist()
    results = index.query(vector=query_embedding, top_k=n_results, include_metadata=True)

    for i, match in enumerate(results['matches']):
        print(f"Chunk {i + 1}:")
        print(f"Text: {match['metadata']['text']}")
        start_time = match['metadata']['start_time']
        end_time = match['metadata']['end_time']
        start_time_formatted = f"{int(start_time // 3600):02}:{int((start_time % 3600) // 60):02}:{int(start_time % 60):02}"
        end_time_formatted = f"{int(end_time // 3600):02}:{int((end_time % 3600) // 60):02}:{int(end_time % 60):02}"
        print(f"File name: {match['metadata']['file_name']}")
        print(f"Start time: {start_time_formatted}")
        print(f"End time: {end_time_formatted}")
        print()

def process_file(file_path, index, report):
    existing_transcription = get_transcription(file_path)
    if existing_transcription:
        print(f"\nUsing existing transcription for {file_path}")
        transcripts = existing_transcription
        report['skipped'] += 1
    else:
        print(f"\nTranscribing audio for {file_path}")
        try:
            transcripts = transcribe_audio(file_path)
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
            chunks = process_transcription(transcript['words'])
            embeddings, model = create_embeddings(chunks)
            store_in_pinecone(index, chunks, embeddings, file_path)
    except Exception as e:
        print(f"Error processing file {file_path}: {e}")
        report['errors'] += 1

def process_directory(directory_path, index):
    report = {'processed': 0, 'skipped': 0, 'errors': 0}
    for root, dirs, files in os.walk(directory_path):
        for file in files:
            if file.lower().endswith(('.mp3', '.wav', '.flac')):
                file_path = os.path.join(root, file)
                process_file(file_path, index, report)
    print(f"\nReport:\nFiles processed: {report['processed']}\nFiles skipped: {report['skipped']}\nFiles with errors: {report['errors']}")

if __name__ == "__main__":
    def usage():
        print("Usage: python test.py -f <file_path> [-q <query>] [-t]")
        print("  -f, --file: Path to audio file or directory")
        print("  -q, --query: Query for similar chunks")
        print("  -t, --transcribe-only: Only transcribe the audio, don't process or store in Chroma")
        sys.exit(1)

    try:
        opts, args = getopt.getopt(sys.argv[1:], "f:q:t", ["file=", "query=", "transcribe-only"])
    except getopt.GetoptError as err:
        print(err)
        usage()

    file_path = None
    query = None
    transcribe_only = False

    for opt, arg in opts:
        if opt in ("-f", "--file"):
            file_path = arg
        elif opt in ("-q", "--query"):
            query = arg
        elif opt in ("-t", "--transcribe-only"):
            transcribe_only = True

    if not file_path:
        usage()
    try:
        # Load environment variables
        load_dotenv('../.env')

        # Initialize Pinecone
        pinecone.init(api_key=os.getenv('PINECONE_API_KEY'), environment="gcp-starter")

        index = load_pinecone(os.getenv('PINECONE_INDEX_NAME'))

        init_db()  # Initialize the SQLite database for transcription indexing

        if file_path:
            if os.path.isdir(file_path):
                if transcribe_only:
                    for root, dirs, files in os.walk(file_path):
                        for file in files:
                            if file.lower().endswith(('.mp3', '.wav', '.flac')):
                                file_path = os.path.join(root, file)
                                print(f"\nTranscribing {file_path}")
                                transcribe_audio(file_path)
                else:
                    process_directory(file_path, index)
            else:
                if transcribe_only:
                    print(f"\nTranscribing {file_path}")
                    transcribe_audio(file_path)
                else:
                    report = {'processed': 0, 'skipped': 0, 'errors': 0}
                    process_file(file_path, index, report)
                    print(f"\nReport:\nFiles processed: {report['processed']}\nFiles skipped: {report['skipped']}\nFiles with errors: {report['errors']}")
        else:
            print("Skipping transcription as no file path is provided")
        
        if query and not transcribe_only:
            print("\nQuerying similar chunks:\n")
            model = SentenceTransformer('all-MiniLM-L6-v2')  
            query_similar_chunks(index, model, query)
        elif not transcribe_only:
            print("No query provided. Exiting.")

    except KeyboardInterrupt:
        print("\nKeyboard interrupt. Exiting.")
        sys.exit(0)
