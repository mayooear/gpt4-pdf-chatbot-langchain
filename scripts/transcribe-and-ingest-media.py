import argparse
import os
import sys
import logging
from dotenv import load_dotenv
from openai import OpenAI, AuthenticationError
from tqdm import tqdm
from media_utils import print_chunk_statistics
from logging_utils import configure_logging
from IngestQueue import IngestQueue
from transcription_utils import init_db, transcribe_media, process_transcription, get_transcription, load_youtube_data_map, save_youtube_data_map, save_youtube_transcription
from pinecone_utils import load_pinecone, create_embeddings, store_in_pinecone, clear_library_vectors
from s3_utils import upload_to_s3
from pinecone_utils import clear_library_vectors
from youtube_utils import download_youtube_audio, extract_youtube_id

logger = logging.getLogger(__name__)

def process_file(file_path, index, client, force, dryrun, author, library_name, is_youtube_video=False, youtube_data=None):
    logger.debug(f"process_file called with params: file_path={file_path}, index={index}, client={client}, force={force}, dryrun={dryrun}, author={author}, library_name={library_name}, is_youtube_video={is_youtube_video}, youtube_data={youtube_data}")
    
    local_report = {'processed': 0, 'skipped': 0, 'errors': 0, 'error_details': [], 'warnings': [], 'fully_indexed': 0, 'chunk_lengths': []}
    
    if is_youtube_video:
        youtube_id = youtube_data['youtube_id']
        file_name = f"YouTube_{youtube_id}"
    else:
        youtube_id = None
        file_name = os.path.basename(file_path) if file_path else "Unknown_File"

    existing_transcription = get_transcription(file_path, is_youtube_video, youtube_id)
    if existing_transcription and not force:
        transcripts = existing_transcription
        local_report['skipped'] += 1
        logger.debug(f"Using existing transcription for {file_name}")
    else:
        logger.info(f"\nTranscribing {'YouTube video' if is_youtube_video else 'audio'} for {file_name}")
        try:
            transcripts = transcribe_media(file_path, force, is_youtube_video, youtube_id)
            if transcripts:
                local_report['processed'] += 1
                if is_youtube_video:
                    save_youtube_transcription(youtube_data, file_path, transcripts)
            else:
                error_msg = f"Error transcribing {'YouTube video' if is_youtube_video else 'file'} {file_name}: No transcripts generated"
                logger.error(error_msg)
                local_report['errors'] += 1
                local_report['error_details'].append(error_msg)
                return local_report
        except Exception as e:
            error_msg = f"Error transcribing {'YouTube video' if is_youtube_video else 'file'} {file_name}: {str(e)}"
            logger.error(error_msg, exc_info=True)
            local_report['errors'] += 1
            local_report['error_details'].append(error_msg)
            return local_report

    try:
        if dryrun:  
            logger.info(f"Dry run mode: Would store chunks for {'YouTube video' if is_youtube_video else 'file'} {file_name} in Pinecone.")

        logger.info(f"Number of transcripts to process: {len(transcripts)}")
        for transcript in tqdm(transcripts, desc=f"Processing transcripts for {file_name}"):
            chunks = process_transcription(transcript)
            local_report['chunk_lengths'].extend([len(chunk['words']) for chunk in chunks])
            if not dryrun:
                try:
                    embeddings = create_embeddings(chunks, client)
                    store_in_pinecone(index, chunks, embeddings, file_path, author, library_name, is_youtube_video, youtube_id)
                except AuthenticationError as e:
                    error_msg = f"Error creating embeddings for {'YouTube video' if is_youtube_video else 'file'} {file_name}: {str(e)}"
                    logger.error(error_msg)
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
        logger.error(error_msg, exc_info=True)
        local_report['errors'] += 1
        local_report['error_details'].append(error_msg)

    return local_report

def initialize_environment(args):
    load_dotenv()
    init_db()
    logger = configure_logging(args.debug)
    return logger

def process_youtube_video(url, logger):
    youtube_id = extract_youtube_id(url)
    youtube_data_map = load_youtube_data_map()
    existing_youtube_data = youtube_data_map.get(youtube_id)
    
    if existing_youtube_data:
        existing_transcription = get_transcription(None, is_youtube_video=True, youtube_id=youtube_id)
        if existing_transcription:
            return existing_youtube_data, youtube_id

    youtube_data = download_youtube_audio(url)
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
    parser.add_argument("--force", action="store_true", help="Force re-transcription and re-indexing")
    parser.add_argument("-c", "--clear-vectors", action="store_true", help="Clear existing vectors before processing")
    parser.add_argument("--dryrun", action="store_true", help="Perform a dry run without sending data to Pinecone or S3")
    parser.add_argument("--override-conflicts", action="store_true", help="Continue processing even if filename conflicts are found")
    parser.add_argument("--debug", action="store_true", help="Enable debug logging")
    args = parser.parse_args()

    logger = initialize_environment(args)
    queue = IngestQueue()

    if args.clear_vectors:
        try:
            index = load_pinecone()
            clear_library_vectors(index, args.library)
        except Exception as e:
            logger.error(f"Error clearing vectors: {str(e)}")
            if not args.override_conflicts:
                logger.error("Exiting due to error in clearing vectors.")
                sys.exit(1)

    client = OpenAI()
    index = load_pinecone()

    while True:
        item = queue.get_next_item()
        if not item:
            logger.info("No more items in the queue. Exiting.")
            break

        logger.debug(f"Processing item: {item}")
        logger.debug(f"Item type: {item.get('type')}")
        logger.debug(f"Item data: {item.get('data')}")

        try:
            if item['type'] == 'youtube_video':
                logger.debug("Processing YouTube video")
                youtube_data = item['data']
                logger.debug(f"YouTube data: {youtube_data}")
                logger.debug(f"YouTube URL: {youtube_data.get('url')}")
                logger.debug(f"YouTube ID: {youtube_data.get('youtube_id')}")
                logger.debug(f"Author: {youtube_data.get('author')}")
                logger.debug(f"Library: {youtube_data.get('library')}")
                
                youtube_data, youtube_id = process_youtube_video(item['data']['url'], logger)
                logger.debug(f"Processed YouTube data: {youtube_data}")
                logger.debug(f"Processed YouTube ID: {youtube_id}")
                
                file_to_process = youtube_data['audio_path']
                is_youtube_video = True
            elif item['type'] == 'audio_file':
                logger.debug("Processing audio file")
                file_to_process = item['data']['file_path']
                logger.debug(f"File to process: {file_to_process}")
                is_youtube_video = False
                youtube_data = None
            else:
                logger.error(f"Unknown item type: {item['type']}")
                queue.update_item_status(item['id'], 'error')
                continue

            logger.debug(f"File to process: {file_to_process}")
            logger.debug(f"Is YouTube video: {is_youtube_video}")

            author = item['data']['author']
            library = item['data']['library']
            logger.debug(f"Author: {author}")
            logger.debug(f"Library: {library}")

            report = process_file(file_to_process, index, client, args.force, dryrun=args.dryrun, 
                                  author=author, library_name=library, 
                                  is_youtube_video=is_youtube_video, youtube_data=youtube_data)
            
            logger.debug(f"Processing report: {report}")

            if is_youtube_video and file_to_process:
                if os.path.exists(file_to_process):
                    os.remove(file_to_process)
                    logger.info(f"Deleted temporary YouTube audio file: {file_to_process}")

            print_report(report)
            queue.update_item_status(item['id'], 'completed')
            queue.remove_item(item['id'])

        except KeyboardInterrupt:
            logger.info("\nKeyboard interrupt. Exiting.")
            queue.update_item_status(item['id'], 'interrupted')
            if is_youtube_video and 'file_to_process' in locals() and os.path.exists(file_to_process):
                os.remove(file_to_process)
                logger.info(f"Deleted temporary YouTube audio file due to interruption: {file_to_process}")
            sys.exit(0)
        except Exception as e:
            logger.error(f"Error processing item {item['id']}: {str(e)}")
            logger.exception("Full traceback:")
            queue.update_item_status(item['id'], 'error')

    queue_status = queue.get_queue_status()
    logger.info(f"Final queue status: {queue_status}")

if __name__ == "__main__":
    main()