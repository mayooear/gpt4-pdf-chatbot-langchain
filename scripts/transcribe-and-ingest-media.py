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
from transcription_utils import init_db, transcribe_media, process_transcription, get_transcription, load_youtube_data_map, save_youtube_data_map, save_youtube_transcription
from pinecone_utils import load_pinecone, create_embeddings, store_in_pinecone, clear_library_vectors
from s3_utils import upload_to_s3, check_unique_filenames
import logging
from pinecone_utils import clear_library_vectors
from youtube_utils import download_youtube_audio, extract_youtube_id
import json

logger = logging.getLogger(__name__)

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
    file_path, force, current_file, total_files, dryrun, library_name, is_youtube, youtube_data = args
    if interrupt_event.is_set():
        return None
    return process_file(file_path, index, client, force, current_file, total_files, dryrun, library_name, logger, is_youtube, youtube_data)

def process_file(file_path, index, client, force=False, current_file=None, total_files=None, dryrun=False, author=None, library_name=None, is_youtube_video=False, youtube_data=None, interrupt_event=None, debug=False, logger=None):
    logger.debug(f"process_file called with params: file_path={file_path}, index={index}, client={client}, force={force}, current_file={current_file}, total_files={total_files}, dryrun={dryrun}, author={author}, library_name={library_name}, is_youtube_video={is_youtube_video}, youtube_data={youtube_data}, interrupt_event={interrupt_event}, debug={debug}, logger={logger}")
    
    local_report = {'processed': 0, 'skipped': 0, 'errors': 0, 'error_details': [], 'warnings': [], 'fully_indexed': 0, 'chunk_lengths': []}
    
    if is_youtube_video:
        youtube_id = youtube_data['youtube_id']
        file_name = f"YouTube_{youtube_id}"
    else:
        youtube_id = None
        file_name = os.path.basename(file_path) if file_path else "Unknown_File"
    
    file_info = f" (file #{current_file} of {total_files}, {current_file/total_files:.1%})" if current_file and total_files else ""

    existing_transcription = get_transcription(file_path, is_youtube_video, youtube_id)
    if existing_transcription and not force:
        transcripts = existing_transcription
        local_report['skipped'] += 1
        logger.debug(f"transcription: {transcripts}")
    else:
        logger.info(f"\nTranscribing {'YouTube video' if is_youtube_video else 'audio'} for {file_name}{file_info}")
        try:
            transcripts = transcribe_media(file_path, force, is_youtube_video, youtube_id, interrupt_event)
            if transcripts:
                local_report['processed'] += 1
                if is_youtube_video:
                    assert(file_path is not None)  # test
                    save_youtube_transcription(youtube_data, file_path, transcripts)
            else:
                error_msg = f"Error transcribing {'YouTube video' if is_youtube_video else 'file'} {file_name}: No transcripts generated"
                logger.error(f"{error_msg}")
                local_report['errors'] += 1
                local_report['error_details'].append(error_msg)
                return local_report
        except Exception as e:
            error_msg = f"Error transcribing {'YouTube video' if is_youtube_video else 'file'} {file_name}: {str(e)}"
            logger.error(f"{error_msg}", exc_info=True)
            local_report['errors'] += 1
            local_report['error_details'].append(error_msg)
            return local_report

    try:
        if dryrun:  
            logger.info(f"Dry run mode: Would store chunks for {'YouTube video' if is_youtube_video else 'file'} {file_name} in Pinecone.")

        logger.info(f"Number of transcripts to process: {len(transcripts)}")
        for i, transcript in tqdm(enumerate(transcripts), total=len(transcripts), desc=f"Processing transcripts for {file_name}"):
            if check_interrupt():
                break
            chunks = process_transcription(transcript)
            local_report['chunk_lengths'].extend([len(chunk['words']) for chunk in chunks])
            if not dryrun:
                try:
                    embeddings = create_embeddings(chunks, client)
                    store_in_pinecone(index, chunks, embeddings, file_path, author, library_name, is_youtube_video, youtube_id, interrupt_event)
                except AuthenticationError as e:
                    error_msg = f"Error creating embeddings for {'YouTube video' if is_youtube_video else 'file'} {file_name}: {str(e)}"
                    logger.error(f"{error_msg}")
                    local_report['errors'] += 1
                    local_report['error_details'].append(error_msg)
                    return local_report
    
        # After successful processing, upload to S3 only if it's not a YouTube video and not a dry run
        if not dryrun and not is_youtube_video and file_path:
            s3_warning = upload_to_s3(file_path)
            if s3_warning:
                local_report['warnings'].append(s3_warning)

        local_report['fully_indexed'] += 1

    except Exception as e:
        error_msg = f"Error processing {'YouTube video' if is_youtube_video else 'file'} {file_name}: {str(e)}"
        logger.error(f"{error_msg}", exc_info=True)
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
            args_list = [(file_path, force, i+1, total_files, dryrun, library_name, False, None) for i, file_path in enumerate(media_files)]
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

def initialize_environment(args):
    load_dotenv()
    init_db()
    logger = configure_logging(args.debug)
    signal.signal(signal.SIGINT, signal_handler)
    return logger

def process_youtube_video(args, logger):
    youtube_id = extract_youtube_id(args.video)
    youtube_data_map = load_youtube_data_map()
    existing_youtube_data = youtube_data_map.get(youtube_id)
    
    if existing_youtube_data:
        existing_transcription = get_transcription(None, is_youtube_video=True, youtube_id=youtube_id)
        if existing_transcription:
            return existing_youtube_data, youtube_id

    youtube_data = download_youtube_audio(args.video)
    if youtube_data:
        return youtube_data, youtube_id
    else:
        logger.error("Failed to download YouTube video audio. Exiting.")
        sys.exit(1)

def print_report(report):
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

def main():
    parser = argparse.ArgumentParser(description="Audio and video transcription and indexing script")
    parser.add_argument("-f", "--file", help="Path to audio file or directory")
    parser.add_argument("--video", help="YouTube video URL")
    parser.add_argument("--author", required=True, help="Author of the media")
    parser.add_argument("--library", required=True, help="Name of the library")
    parser.add_argument("--force", action="store_true", help="Force re-transcription and re-indexing")
    parser.add_argument("-c", "--clear-vectors", action="store_true", help="Clear existing vectors before processing")
    parser.add_argument("--dryrun", action="store_true", help="Perform a dry run without sending data to Pinecone or S3")
    parser.add_argument("--override-conflicts", action="store_true", help="Continue processing even if filename conflicts are found")
    parser.add_argument("--debug", action="store_true", help="Enable debug logging")
    args = parser.parse_args()

    logger = initialize_environment(args)

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
        file_to_process = args.file
        is_youtube_video = False
        youtube_data = None

        if args.video:
            youtube_data, youtube_id = process_youtube_video(args, logger)
            file_to_process = youtube_data['audio_path']
            is_youtube_video = True

        if file_to_process or (is_youtube_video and youtube_data):
            client = OpenAI()
            index = load_pinecone()

            if file_to_process and os.path.isdir(file_to_process):
                conflicts = check_unique_filenames(file_to_process)
                if conflicts and not args.override_conflicts:
                    logger.error("Filename conflicts found:")
                    for file, locations in conflicts.items():
                        logger.error(f"\n{file}:")
                        for location in locations:
                            logger.error(f"  - {location}")
                    logger.error("Exiting due to filename conflicts. Use --override-conflicts to continue processing.")
                    sys.exit(1)

                report = process_directory(file_to_process, args.force, args.dryrun, args.debug, args.library)
            else:
                report = process_file(file_to_process, index, client, args.force, dryrun=args.dryrun, 
                                      author=args.author, library_name=args.library, 
                                      is_youtube_video=is_youtube_video, youtube_data=youtube_data,
                                      interrupt_event=interrupt_event, debug=args.debug, logger=logger)

            if is_youtube_video and file_to_process:
                if os.path.exists(file_to_process):
                    os.remove(file_to_process)
                    logger.info(f"Deleted temporary YouTube audio file: {file_to_process}")

            print_report(report)
        elif not args.video:
            parser.print_help()

    except KeyboardInterrupt:
        logger.info("\nKeyboard interrupt. Exiting.")
        if is_youtube_video and os.path.exists(file_to_process):
            os.remove(file_to_process)
            logger.info(f"Deleted temporary YouTube audio file due to interruption: {file_to_process}")
        sys.exit(0)

if __name__ == "__main__":
    main()