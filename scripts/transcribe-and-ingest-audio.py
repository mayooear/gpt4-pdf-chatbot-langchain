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

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10),
    retry=retry_if_exception_type((APITimeoutError, APIError)),
    reraise=False
)
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
        print("\n*** ERROR *** OpenAI API request timed out. Retrying...")
        raise
    except APIError as e:
        print(f"\n*** ERROR *** OpenAI API error: {e}")
        raise
    except Exception as e:
        print(f"\n*** ERROR *** Error transcribing chunk. Exception type: {type(e).__name__}, Arguments: {e.args}, Full exception: {e}")
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
        transcript = transcribe_chunk(client, chunk, previous_transcript, cumulative_time)
        if transcript:
            transcripts.append(transcript)
            previous_transcript = transcript['text']
            cumulative_time += chunk.duration_seconds
        else:
            print(f"\n*** ERROR *** Empty or invalid transcript for chunk {i+1} in {file_name}")
    
    if transcripts:
        save_transcription(file_path, transcripts)
        return transcripts
    else:
        error_msg = f"No transcripts generated for {file_name}"
        print(f"\n*** ERROR *** {error_msg}")
        return None, error_msg  # Return None and the error message

def create_embeddings(chunks, client):
    texts = [chunk['text'] for chunk in chunks]
    response = client.embeddings.create(input=texts, model="text-embedding-ada-002")
    return [embedding.embedding for embedding in response.data]

def load_pinecone(index_name):
    if index_name not in pc.list_indexes().names():
        pc.create_index(index_name, dimension=1536, metric="cosine")
    return pc.Index(index_name)

def get_audio_metadata(file_path):
    try:
        audio = MP3(file_path)
        title = audio.tags.get('TIT2', [os.path.splitext(os.path.basename(file_path))[0]])[0]
        author = audio.tags.get('TPE1', ['Swami Kriyananda'])[0]
        return title, author
    except Exception as e:
        print(f"Error reading MP3 metadata: {e}")
        return os.path.splitext(os.path.basename(file_path))[0], 'Swami Kriyananda'

def store_in_pinecone(index, chunks, embeddings, file_path):
    file_name = os.path.basename(file_path)
    file_hash = hashlib.md5(open(file_path, 'rb').read()).hexdigest()
    
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
    total_chunks = sum(len(process_transcription(transcript)) for transcript in transcripts)
    return total_chunks

def is_file_fully_indexed(index, file_path):
    file_hash = hashlib.md5(open(file_path, 'rb').read()).hexdigest()
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
    file_path, force, current_file, total_files = args
    if check_interrupt():
        return None
    return process_file(file_path, index, client, force, current_file, total_files)

def process_file(file_path, index, client, force=False, current_file=None, total_files=None):
    local_report = {'processed': 0, 'skipped': 0, 'errors': 0, 'error_details': []}
    file_name = os.path.basename(file_path)
    file_info = f" (file #{current_file} of {total_files}, {current_file/total_files:.1%})" if current_file and total_files else ""
    existing_transcription = get_transcription(file_path)
    if existing_transcription and not force:
        if is_file_fully_indexed(index, file_path):
            print(f"\nFile already fully transcribed and indexed: {file_name}{file_info}")
            local_report['skipped'] += 1
            return local_report
        else:
            print(f"\nFile transcribed but not fully indexed. Re-processing: {file_name}{file_info}")
            transcripts = existing_transcription
    else:
        print(f"\nTranscribing audio for {file_name}{file_info}")
        try:
            transcripts, error_msg = transcribe_audio(file_path, force, current_file, total_files)
            if transcripts:
                local_report['processed'] += 1
            else:
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
        for i, transcript in tqdm(enumerate(transcripts), total=len(transcripts), desc=f"Processing transcripts for {file_name}"):
            chunks = process_transcription(transcript)
            embeddings = create_embeddings(chunks, client)
            store_in_pinecone(index, chunks, embeddings, file_path)
    except Exception as e:
        error_msg = f"Error processing file {file_name}: {str(e)}"
        print(f"\n*** ERROR *** {error_msg}")
        local_report['errors'] += 1
        local_report['error_details'].append(error_msg)

    return local_report

def process_directory(directory_path, force=False):
    audio_files = []
    for root, dirs, files in os.walk(directory_path):
        for file in files:
            if file.lower().endswith(('.mp3', '.wav', '.flac')):
                audio_files.append(os.path.join(root, file))
    
    total_files = len(audio_files)
    
    # Calculate the number of processes
    max_processes = multiprocessing.cpu_count()
    reduced_processes = max(1, int(max_processes * 0.7))  # Reduce by 30%
    num_processes = min(reduced_processes, 4)  # Cap at 4 processes
    
    print(f"Using {num_processes} processes for parallel processing")
    
    # Use multiprocessing to process files in parallel
    with multiprocessing.Pool(processes=num_processes, initializer=init_worker) as pool:
        try:
            args_list = [(file_path, force, i+1, total_files) for i, file_path in enumerate(audio_files)]
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
    report = {'processed': 0, 'skipped': 0, 'errors': 0, 'error_details': []}
    for result in results:
        report['processed'] += result['processed']
        report['skipped'] += result['skipped']
        report['errors'] += result['errors']
        report['error_details'].extend(result.get('error_details', []))
    
    print(f"\nFinal Report:")
    print(f"Files processed: {report['processed']}")
    print(f"Files skipped: {report['skipped']}")
    print(f"Files with errors: {report['errors']}")
    
    if report['errors'] > 0:
        print("\nError details:")
        for error in report['error_details']:
            print(f"- {error}")

    return report  # Return the report for use in the main function

def signal_handler(sig, frame):
    global interrupt_requested, force_exit
    if not interrupt_requested.value:
        print('\nCtrl+C pressed. Finishing current files and then exiting...')
        interrupt_requested.value = True
    else:
        print('\nCtrl+C pressed again. Forcing immediate exit...')
        force_exit.value = True
        sys.exit(0)

# Add this function to check for interrupts
def check_interrupt():
    if force_exit.value:
        sys.exit(0)
    return interrupt_requested.value

if __name__ == "__main__":
    def usage():
        print("Usage: python transcribe-audio.py -f <file_path> [-q <query>] [-t] [--force] [-c]")
        print("  -f, --file: Path to audio file or directory")
        print("  -q, --query: Query for similar chunks")
        print("  -t, --transcribe-only: Only transcribe the audio, don't process or store in Chroma")
        print("  --force: Force re-transcription even if a transcription already exists")
        print("  -c, --clear-treasures-vectors: Clear existing Treasures vectors from Pinecone before processing")
        sys.exit(1)

    try:
        opts, args = getopt.getopt(sys.argv[1:], "f:q:tc", ["file=", "query=", "transcribe-only", "force", "clear-treasures-vectors"])
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
        elif opt in ("-c", "--clear-treasures-vectors"):
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
                            if check_interrupt():
                                print("Interrupt requested. Exiting...")
                                sys.exit(0)
                else:
                    report = process_directory(file_path, force_transcribe)
            else:
                if transcribe_only:
                    print(f"\nTranscribing {file_path}")
                    transcribe_audio(file_path, force_transcribe)
                else:
                    # For single file processing, create client and index here
                    client = OpenAI()
                    pc = Pinecone(api_key=os.getenv('PINECONE_API_KEY'))
                    index = pc.Index(os.getenv('PINECONE_INDEX_NAME'))
                    report = process_file(file_path, index, client, force_transcribe)
                    print(f"\nReport:\nFiles processed: {report['processed']}\nFiles skipped: {report['skipped']}\nFiles with errors: {report['errors']}")
                    if report['errors'] > 0:
                        print("\nError details:")
                        for error in report['error_details']:
                            print(f"- {error}")

        if query and not transcribe_only:
            query_similar_chunks(index, client, query)
        elif not file_path and not transcribe_only:
            print("No file path or query provided. Exiting.")

    except KeyboardInterrupt:
        print("\nKeyboard interrupt. Exiting.")
        sys.exit(0)

