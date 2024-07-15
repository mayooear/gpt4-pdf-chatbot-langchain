import argparse
import os
import sys
import multiprocessing
import signal
import traceback
from dotenv import load_dotenv
from openai import OpenAI
from tqdm import tqdm
from audio_utils import get_file_hash, print_chunk_statistics
from transcription_utils import init_db, transcribe_audio, process_transcription, get_transcription
from pinecone_utils import load_pinecone, create_embeddings, store_in_pinecone, query_similar_chunks, clear_treasures_vectors
from s3_utils import upload_to_s3, check_unique_filenames

# Global variables and constants
interrupt_requested = multiprocessing.Value('b', False)
force_exit = multiprocessing.Value('b', False)

def init_worker():
    global client, index
    client = OpenAI()
    index = load_pinecone()
    signal.signal(signal.SIGINT, signal.SIG_IGN)

def process_file_wrapper(args):
    file_path, force, current_file, total_files, dryrun = args
    if check_interrupt():
        return None
    return process_file(file_path, index, client, force, current_file, total_files, dryrun)

def process_file(file_path, index, client, force=False, current_file=None, total_files=None, dryrun=False):
    local_report = {'processed': 0, 'skipped': 0, 'errors': 0, 'error_details': [], 'warnings': [], 'fully_indexed': 0, 'chunk_lengths': []}
    file_name = os.path.basename(file_path)
    file_info = f" (file #{current_file} of {total_files}, {current_file/total_files:.1%})" if current_file and total_files else ""

    existing_transcription = get_transcription(file_path)
    if existing_transcription and not force:
        print(f"\nFile already transcribed. Indexing: {file_name}{file_info}")
        transcripts = existing_transcription
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

        # TODO: future optimization Is to combine the transcripts together and then
        # Process them all at once, Because right now we don't do any overlap between the end of 
        # one transcript and the start of the next, so we end up with a bunch of chunks that are 
        # 100% the same. ?????
        for i, transcript in tqdm(enumerate(transcripts), total=len(transcripts), desc=f"Processing transcripts for {file_name}"):
            if check_interrupt():
                break
            chunks = process_transcription(transcript)
            local_report['chunk_lengths'].extend([len(chunk['words']) for chunk in chunks])
            embeddings = create_embeddings(chunks, client)
            store_in_pinecone(index, chunks, embeddings, file_path, dryrun)
    
        # After successful processing, upload to S3
        if not dryrun:
            s3_warning = upload_to_s3(file_path)
            if s3_warning:
                local_report['warnings'].append(s3_warning)

        local_report['fully_indexed'] += 1

    except Exception as e:
        error_msg = f"Error processing file {file_name}: {str(e)}, Full exception: {traceback.format_exc()}"
        print(f"\n*** ERROR *** {error_msg}")
        local_report['errors'] += 1
        local_report['error_details'].append(error_msg)

    return local_report

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
    num_processes = min(reduced_processes, 4)  # Cap num of processes
    print(f"Using {num_processes} processes for parallel processing")

    # preload pinecone index so it creates if needed before multiprocessing, to avoid
    # multiprocessing trying to create several times in a race!
    load_pinecone()

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
    report = {'processed': 0, 'skipped': 0, 'errors': 0, 'error_details': [], 'warnings': [], 'fully_indexed': 0, 'chunk_lengths': []}
    for result in results:
        report['processed'] += result['processed']
        report['skipped'] += result['skipped']
        report['errors'] += result['errors']
        report['error_details'].extend(result.get('error_details', []))
        report['warnings'].extend(result.get('warnings', []))
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

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Audio transcription and indexing script")
    parser.add_argument("-f", "--file", help="Path to audio file or directory")
    parser.add_argument("-q", "--query", help="Query for similar chunks")
    parser.add_argument("--force", action="store_true", help="Force re-transcription and re-indexing")
    parser.add_argument("-c", "--clear-vectors", action="store_true", help="Clear existing vectors before processing")
    parser.add_argument("--dryrun", action="store_true", help="Perform a dry run without sending data to Pinecone or S3")
    parser.add_argument("--override-conflicts", action="store_true", help="Continue processing even if filename conflicts are found")
    parser.add_argument("--transcribe-only", action="store_true", help="Only transcribe the audio, don't process or store in Pinecone")
    args = parser.parse_args()

    load_dotenv()
    init_db()

    signal.signal(signal.SIGINT, signal_handler)

    if args.clear_vectors:
        index = load_pinecone()
        clear_treasures_vectors(index)

    try:
        if args.file:
            if os.path.isdir(args.file):
                conflicts = check_unique_filenames(args.file)
                if conflicts and not args.override_conflicts:
                    print("Filename conflicts found:")
                    for file, locations in conflicts.items():
                        print(f"\n{file}:")
                        for location in locations:
                            print(f"  - {location}")
                    print("Exiting due to filename conflicts. Use --override-conflicts to continue processing.")
                    sys.exit(1)

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
                    print("\nProcessing complete. Summary:")
                    print(f"Files processed: {report['processed']}")
                    print(f"Files skipped: {report['skipped']}")
                    print(f"Errors encountered: {report['errors']}")
                    if report['warnings']:
                        print("Warnings:")
                        for warning in report['warnings']:
                            print(f"- {warning}")
                    if report['error_details']:
                        print("Error details:")
                        for error in report['error_details']:
                            print(f"- {error}")
                    print_chunk_statistics(report['chunk_lengths'])
            else:
                if args.transcribe_only:
                    print(f"\nTranscribing {args.file}")
                    transcribe_audio(args.file, args.force)
                else:
                    client = OpenAI()
                    index = load_pinecone()
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
                    print_chunk_statistics(report['chunk_lengths'])

        if args.query and not args.transcribe_only:
            client = OpenAI()
            index = load_pinecone()
            results = query_similar_chunks(index, client, args.query)
            for i, result in enumerate(results, 1):
                print(f"\nResult {i}:")
                print(f"Text: {result['metadata']['text']}")
                print(f"File: {result['metadata']['file_name']}")
                print(f"Start time: {result['metadata']['start']:.2f}s")
                print(f"End time: {result['metadata']['end']:.2f}s")
                print(f"Similarity: {result['score']:.4f}")

        if not args.file and not args.query:
            parser.print_help()

    except KeyboardInterrupt:
        print("\nKeyboard interrupt. Exiting.")
        sys.exit(0)