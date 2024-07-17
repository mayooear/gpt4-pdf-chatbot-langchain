import argparse
import os
import sys
import multiprocessing
import signal
import traceback
from dotenv import load_dotenv
from openai import OpenAI, AuthenticationError
from tqdm import tqdm
from media_utils import get_file_hash, print_chunk_statistics
from transcription_utils import init_db, transcribe_media, process_transcription, get_transcription, load_youtube_hash_map, save_youtube_hash_map, get_transcription_by_youtube_id, save_youtube_transcription
from pinecone_utils import load_pinecone, create_embeddings, store_in_pinecone, clear_library_vectors
from s3_utils import upload_to_s3, check_unique_filenames
import logging
from pinecone_utils import clear_library_vectors
from youtube_utils import download_youtube_audio, extract_youtube_id

# Global variables and constants
interrupt_event = multiprocessing.Event()

def configure_logging(debug=False):
    # Configure the root logger
    logging.basicConfig(level=logging.DEBUG if debug else logging.INFO, 
                        format='%(asctime)s - %(levelname)s - %(message)s')
    
    # Configure specific loggers
    loggers_to_adjust = [
        "openai", "httpx", "httpcore", "boto3", "botocore", "urllib3", "s3transfer", "subprocess"
    ]
    for logger_name in loggers_to_adjust:
        logging.getLogger(logger_name).setLevel(logging.INFO if debug else logging.WARNING)
        
    return logging.getLogger(__name__)

def init_worker(event, debug, library_name):
    global client, index, interrupt_event, logger, library
    client = OpenAI()
    index = load_pinecone()
    interrupt_event = event
    library = library_name
    signal.signal(signal.SIGINT, signal.SIG_IGN)
    
    # Use the centralized logging configuration
    logger = configure_logging(debug)

def process_file_wrapper(args):
    file_path, force, current_file, total_files, dryrun, library_name, is_youtube = args
    if interrupt_event.is_set():
        return None
    return process_file(file_path, index, client, force, current_file, total_files, dryrun, library_name, logger, is_youtube)

def process_file(file_path, index, client, force=False, current_file=None, total_files=None, dryrun=False, author=None, library_name=None, is_youtube_video=False, interrupt_event=None, debug=False):
    local_report = {'processed': 0, 'skipped': 0, 'errors': 0, 'error_details': [], 'warnings': [], 'fully_indexed': 0, 'chunk_lengths': []}
    file_name = os.path.basename(file_path)
    file_info = f" (file #{current_file} of {total_files}, {current_file/total_files:.1%})" if current_file and total_files else ""

    existing_transcription = get_transcription(file_path)
    if existing_transcription and not force:
        logger.info(f"\nFile already transcribed. Indexing: {file_name}{file_info}")
        transcripts = existing_transcription
    else:
        logger.info(f"\nTranscribing audio for {file_name}{file_info}")
        try:
            transcripts = transcribe_media(file_path, force)
            if transcripts:
                local_report['processed'] += 1
            else:
                error_msg = f"Error transcribing file {file_name}: No transcripts generated"
                logger.error(f"\n*** ERROR *** {error_msg}")
                local_report['errors'] += 1
                local_report['error_details'].append(error_msg)
                return local_report
        except Exception as e:
            error_msg = f"Error transcribing file {file_name}: {str(e)}"
            logger.error(f"\n*** ERROR *** {error_msg}")
            local_report['errors'] += 1
            local_report['error_details'].append(error_msg)
            return local_report

    try:
        if dryrun:  
            logger.info(f"Dry run mode: Would store chunks for file {file_path} in Pinecone.")

        for i, transcript in tqdm(enumerate(transcripts), total=len(transcripts), desc=f"Processing transcripts for {file_name}"):
            if check_interrupt():
                break
            chunks = process_transcription(transcript)
            local_report['chunk_lengths'].extend([len(chunk['words']) for chunk in chunks])
            if not dryrun:
                try:
                    embeddings = create_embeddings(chunks, client)
                    store_in_pinecone(index, chunks, embeddings, file_path, author, library_name, is_youtube_video, interrupt_event)
                except AuthenticationError as e:
                    error_msg = f"Authentication error for file {file_name}: {str(e)}"
                    logger.error(f"\n*** ERROR *** {error_msg}")
                    local_report['errors'] += 1
                    local_report['error_details'].append(error_msg)
                    return local_report
    
        # After successful processing, upload to S3 only if it's not a YouTube video
        if not dryrun and not is_youtube_video:
            s3_warning = upload_to_s3(file_path)
            if s3_warning:
                local_report['warnings'].append(s3_warning)

        local_report['fully_indexed'] += 1

    except Exception as e:
        error_msg = f"Error processing file {file_name}: {str(e)}, Full exception: {traceback.format_exc()}"
        logger.error(f"\n*** ERROR *** {error_msg}")
        local_report['errors'] += 1
        local_report['error_details'].append(error_msg)

    return local_report

def check_interrupt():
    if interrupt_event.is_set():
        logger.info("Interrupt requested. Exiting...")
        return True
    return False

def process_directory(directory_path, force=False, dryrun=False, debug=False, library_name=None):
    media_files = []
    processed_hashes = set()
    skipped_files = []

    for root, dirs, files in os.walk(directory_path):
        for file in files:
            if file.lower().endswith(('.mp3', '.wav', '.flac', '.mp4', '.avi', '.mov')): 
                file_path = os.path.join(root, file)
                file_hash = get_file_hash(file_path)
                
                if file_hash in processed_hashes:
                    logger.info(f"Skipping duplicate content: {file_path}")
                    skipped_files.append(file_path)
                    continue
                
                media_files.append(file_path)
                processed_hashes.add(file_hash)
    
    total_files = len(media_files)
    
    # Calculate the number of processes
    max_processes = multiprocessing.cpu_count()
    reduced_processes = max(1, int(max_processes * 0.7))  # Reduce by 30%
    num_processes = min(reduced_processes, 4)  # Cap num of processes
    logger.info(f"Using {num_processes} processes for parallel processing")

    # preload pinecone index so it creates if needed before multiprocessing, to avoid
    # multiprocessing trying to create several times in a race!
    load_pinecone()

    # Use multiprocessing to process files in parallel
    with multiprocessing.Pool(processes=num_processes, initializer=init_worker, initargs=(interrupt_event, debug, library_name)) as pool:
        try:
            args_list = [(file_path, force, i+1, total_files, dryrun, library_name, False) for i, file_path in enumerate(media_files)]
            results = []
            for result in pool.imap_unordered(process_file_wrapper, args_list):
                if result is None or interrupt_event.is_set():
                    logger.info("Interrupt detected. Stopping processing...")
                    pool.terminate()
                    break
                results.append(result)
        except KeyboardInterrupt:
            logger.info("KeyboardInterrupt received. Terminating workers...")
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
    
    if skipped_files:
        logger.info("\nSkipped files due to duplicate content:")
        for file in skipped_files:
            logger.info(f"- {file}")

    return report

def signal_handler(sig, frame):
    logger.info('\nCtrl+C pressed. Gracefully shutting down...')
    interrupt_event.set()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Audio and video transcription and indexing script")
    parser.add_argument("-f", "--file", help="Path to audio file or directory")
    parser.add_argument("--video", help="YouTube video URL")
    parser.add_argument("--author", required=True, help="Author of the media")
    parser.add_argument("--library", required=True, help="Name of the library")
    parser.add_argument("--force", action="store_true", help="Force re-transcription and re-indexing")
    parser.add_argument("-c", "--clear-vectors", action="store_true", help="Clear existing vectors before processing")
    parser.add_argument("--dryrun", action="store_true", help="Perform a dry run without sending data to Pinecone or S3")
    parser.add_argument("--override-conflicts", action="store_true", help="Continue processing even if filename conflicts are found")
    parser.add_argument("--transcribe-only", action="store_true", help="Only transcribe the media, don't process or store in Pinecone")
    parser.add_argument("--debug", action="store_true", help="Enable debug logging")
    args = parser.parse_args()

    load_dotenv()
    init_db()

    # Use the centralized logging configuration
    logger = configure_logging(args.debug)

    signal.signal(signal.SIGINT, signal_handler)

    if args.clear_vectors:
        try:
            index = load_pinecone()
            clear_library_vectors(index, args.library)
        except Exception as e:
            logger.error(f"Error clearing vectors: {str(e)}")
            if not args.override_conflicts:
                logger.error("Exiting due to error in clearing vectors.")
                sys.exit(1)

    try:
        if args.video:
            youtube_id = extract_youtube_id(args.video)
            existing_transcription = get_transcription_by_youtube_id(youtube_id)
            if existing_transcription:
                logger.info(f"Using existing transcription for YouTube video: {args.video}")
                print_chunk_statistics(existing_transcription['chunk_lengths'])
                sys.exit(0)

            youtube_data = download_youtube_audio(args.video)
            if youtube_data:
                args.file = youtube_data['audio_path']
                is_youtube_video = True
            else:
                logger.error("Failed to download YouTube video audio. Exiting.")
                sys.exit(1)
        else:
            is_youtube_video = False

        if args.file:
            if os.path.isdir(args.file):
                conflicts = check_unique_filenames(args.file)
                if conflicts and not args.override_conflicts:
                    logger.error("Filename conflicts found:")
                    for file, locations in conflicts.items():
                        logger.error(f"\n{file}:")
                        for location in locations:
                            logger.error(f"  - {location}")
                    logger.error("Exiting due to filename conflicts. Use --override-conflicts to continue processing.")
                    sys.exit(1)

                if args.transcribe_only:
                    for root, dirs, files in os.walk(args.file):
                        for file in files:
                            if file.lower().endswith(('.mp3', '.wav', '.flac', '.mp4', '.avi', '.mov')):
                                file_path = os.path.join(root, file)
                                logger.info(f"\nTranscribing {file_path}")
                                transcribe_media(file_path, args.force)
                            if check_interrupt():
                                logger.info("Interrupt requested. Exiting...")
                                sys.exit(0)
                else:
                    report = process_directory(args.file, args.force, args.dryrun, args.debug, args.library)
            else:
                if args.transcribe_only:
                    logger.info(f"\nTranscribing {args.file}")
                    transcribe_media(args.file, args.force)
                else:
                    client = OpenAI()
                    index = load_pinecone()
                    report = process_file(args.file, index, client, args.force, dryrun=args.dryrun, author=args.author, library_name=args.library, is_youtube_video=is_youtube_video, interrupt_event=interrupt_event, debug=args.debug)
                    if is_youtube_video and report['errors'] == 0:
                        save_youtube_transcription(youtube_id, args.file, report)
                    elif is_youtube_video and os.path.exists(args.file):
                        os.remove(args.file)
                        logger.info(f"Deleted temporary YouTube audio file due to errors: {args.file}")
                    logger.info(f"\nReport:")
                    logger.info(f"Files processed: {report['processed']}")
                    logger.info(f"Files skipped: {report['skipped']}")
                    logger.info(f"Files with errors: {report['errors']}")
                    if report['errors'] > 0:
                        logger.error("\nError details:")
                        for error in report['error_details']:
                            logger.error(f"- {error}")
                    if report['warnings']:
                        logger.warning("\nWarnings:")
                        for warning in report['warnings']:
                            logger.warning(f"- {warning}")
                    print_chunk_statistics(report['chunk_lengths'])

        if not args.file and not args.video:
            parser.print_help()

    except KeyboardInterrupt:
        logger.info("\nKeyboard interrupt. Exiting.")
        if is_youtube_video and os.path.exists(args.file):
            os.remove(args.file)
            logger.info(f"Deleted temporary YouTube audio file due to interruption: {args.file}")
        sys.exit(0)