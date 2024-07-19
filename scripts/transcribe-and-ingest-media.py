import argparse
import os
import sys
import logging
from dotenv import load_dotenv
from openai import OpenAI, AuthenticationError
from tqdm import tqdm
from media_utils import get_media_metadata, print_chunk_statistics
from logging_utils import configure_logging
from IngestQueue import IngestQueue
from transcription_utils import (
    init_db,
    transcribe_media,
    process_transcription,
    get_transcription,
    load_youtube_data_map,
    save_youtube_data_map,
    save_youtube_transcription,
)
from pinecone_utils import (
    load_pinecone,
    create_embeddings,
    store_in_pinecone,
    clear_library_vectors,
)
from s3_utils import upload_to_s3
from pinecone_utils import clear_library_vectors
from youtube_utils import download_youtube_audio, extract_youtube_id
from multiprocessing import Pool, cpu_count
import atexit
import signal
from functools import partial

logger = logging.getLogger(__name__)


def reset_terminal():
    """Reset the terminal to its normal state."""
    if os.name == 'posix':  # For Unix-like systems
        os.system('stty sane')
    print('\033[?25h', end='')  # Show the cursor
    print('\033[0m', end='')    # Reset all attributes
    print('', flush=True)       # Ensure a newline and flush the output

# Register the reset_terminal function to be called on exit
atexit.register(reset_terminal)


def process_file(
    file_path,
    index,
    client,
    force,
    dryrun,
    author,
    library_name,
    is_youtube_video=False,
    youtube_data=None,
):
    logger.debug(
        f"process_file called with params: file_path={file_path}, index={index}, client={client}, force={force}, dryrun={dryrun}, author={author}, library_name={library_name}, is_youtube_video={is_youtube_video}, youtube_data={youtube_data}"
    )

    local_report = {
        "processed": 0,
        "skipped": 0,
        "errors": 0,
        "error_details": [],
        "warnings": [],
        "fully_indexed": 0,
        "chunk_lengths": [],
    }

    if is_youtube_video:
        youtube_id = youtube_data["youtube_id"]
        file_name = f"YouTube_{youtube_id}"
    else:
        youtube_id = None
        file_name = os.path.basename(file_path) if file_path else "Unknown_File"

    existing_transcription = get_transcription(file_path, is_youtube_video, youtube_id)
    if existing_transcription and not force:
        transcripts = existing_transcription
        local_report["skipped"] += 1
        logger.debug(f"Using existing transcription for {file_name}")
    else:
        logger.info(
            f"\nTranscribing {'YouTube video' if is_youtube_video else 'audio'} for {file_name}"
        )
        try:
            transcripts = transcribe_media(
                file_path, force, is_youtube_video, youtube_id
            )
            if transcripts:
                local_report["processed"] += 1
                if is_youtube_video:
                    save_youtube_transcription(youtube_data, file_path, transcripts)
            else:
                error_msg = f"Error transcribing {'YouTube video' if is_youtube_video else 'file'} {file_name}: No transcripts generated"
                logger.error(error_msg)
                local_report["errors"] += 1
                local_report["error_details"].append(error_msg)
                return local_report
        except Exception as e:
            error_msg = f"Error transcribing {'YouTube video' if is_youtube_video else 'file'} {file_name}: {str(e)}"
            logger.error(error_msg, exc_info=True)
            local_report["errors"] += 1
            local_report["error_details"].append(error_msg)
            return local_report

    try:
        if dryrun:
            logger.info(
                f"Dry run mode: Would store chunks for {'YouTube video' if is_youtube_video else 'file'} {file_name} in Pinecone."
            )

        logger.info(f"Number of transcripts to process: {len(transcripts)}")
        for transcript in tqdm(
            transcripts, desc=f"Processing transcripts for {file_name}"
        ):
            chunks = process_transcription(transcript)
            local_report["chunk_lengths"].extend(
                [len(chunk["words"]) for chunk in chunks]
            )
            if not dryrun:
                try:
                    embeddings = create_embeddings(chunks, client)
                    
                    # Use youtube_data for metadata if it's a YouTube video
                    if is_youtube_video and youtube_data and "media_metadata" in youtube_data:
                        metadata = youtube_data["media_metadata"]
                        title = metadata.get("title", "Unknown Title")
                        duration = metadata.get("duration")
                        url = metadata.get("url")
                    else:
                        title, _, duration, url = get_media_metadata(file_path)
                    
                    store_in_pinecone(
                        index,
                        chunks,
                        embeddings,
                        file_path,
                        author,
                        library_name,
                        is_youtube_video,
                        youtube_id,
                        title=title,
                        duration=duration,
                        url=url
                    )
                except Exception as e:
                    error_msg = f"Error processing {'YouTube video' if is_youtube_video else 'file'} {file_name}: {str(e)}"
                    logger.error(error_msg)
                    logger.error(f"Caught exception: {e}")
                    local_report["errors"] += 1
                    local_report["error_details"].append(error_msg)
                    return local_report

        # After successful processing, upload to S3 only if it's not a YouTube video and not a dry run
        if not dryrun and not is_youtube_video and file_path:
            s3_warning = upload_to_s3(file_path)
            if s3_warning:
                local_report["warnings"].append(s3_warning)

        local_report["fully_indexed"] += 1

    except Exception as e:
        error_msg = f"Error processing {'YouTube video' if is_youtube_video else 'file'} {file_name}: {str(e)}"
        logger.error(error_msg, exc_info=True)
        local_report["errors"] += 1
        local_report["error_details"].append(error_msg)

    return local_report


def process_item(item, args):
    """Process a media item (audio file or YouTube video) in a separate process"""

    # Initialize resources for this process
    client = OpenAI()
    index = load_pinecone()

    if item["type"] == "audio_file":
        file_to_process = item["data"]["file_path"]
        is_youtube_video = False
        youtube_data = None
    elif item["type"] == "youtube_video":
        youtube_data, youtube_id = preprocess_youtube_video(item["data"]["url"], logger)
        if not youtube_data:
            logger.error("Failed to process YouTube video.")
            return item["id"], {"errors": 1, "error_details": ["Failed to process YouTube video"]}
        file_to_process = youtube_data["audio_path"]
        is_youtube_video = True
    else:
        logger.error(f"Unknown item type: {item['type']}")
        return item["id"], {"errors": 1, "error_details": [f"Unknown item type: {item['type']}"]}

    author = item["data"]["author"]
    library = item["data"]["library"]
    logger.debug(f"Author: {author}")
    logger.debug(f"Library: {library}")

    report = process_file(
        file_to_process,
        index,
        client,
        args.force,
        dryrun=args.dryrun,
        author=author,
        library_name=library,
        is_youtube_video=is_youtube_video,
        youtube_data=youtube_data,
    )

    # Clean up temporary YouTube audio file if necessary
    if is_youtube_video and file_to_process and os.path.exists(file_to_process):
        os.remove(file_to_process)
        logger.info(f"Deleted temporary YouTube audio file: {file_to_process}")

    return item["id"], report


def initialize_environment(args):
    load_dotenv()
    init_db()
    logger = configure_logging(args.debug)
    return logger


def preprocess_youtube_video(url, logger):
    youtube_id = extract_youtube_id(url)
    youtube_data_map = load_youtube_data_map()
    existing_youtube_data = youtube_data_map.get(youtube_id)

    if existing_youtube_data:
        existing_transcription = get_transcription(
            None, is_youtube_video=True, youtube_id=youtube_id
        )
        if existing_transcription:
            logger.debug(f"preprocess_youtube_video: Using existing transcription for YouTube video")
            return existing_youtube_data, youtube_id

    youtube_data = download_youtube_audio(url)
    if youtube_data:
        return youtube_data, youtube_id
    else:
        logger.error("Failed to download YouTube video audio.")
        return None, None


def print_report(report):
    logger.info(f"\nReport:")
    logger.info(f"Files processed: {report['processed']}")
    logger.info(f"Files skipped: {report['skipped']}")
    logger.info(f"Files with errors: {report['errors']}")
    if report["errors"] > 0:
        logger.error("\nError details:")
        for error in report["error_details"]:
            logger.error(f"- {error}")
    if report["warnings"]:
        logger.warning("\nWarnings:")
        for warning in report["warnings"]:
            logger.warning(f"- {warning}")
    print_chunk_statistics(report["chunk_lengths"])


def merge_reports(reports):
    combined_report = {
        "processed": 0,
        "skipped": 0,
        "errors": 0,
        "error_details": [],
        "warnings": [],
        "fully_indexed": 0,
        "chunk_lengths": [],
    }
    for report in reports:
        for key in ["processed", "skipped", "errors", "fully_indexed"]:
            combined_report[key] += report[key]
        combined_report["error_details"].extend(report["error_details"])
        combined_report["warnings"].extend(report["warnings"])
        combined_report["chunk_lengths"].extend(report["chunk_lengths"])
    return combined_report


def graceful_shutdown(pool, queue, items_to_process, overall_report, signum, frame):
    logger.info("\nReceived interrupt signal. Shutting down gracefully...")
    pool.terminate()
    pool.join()
    for item in items_to_process:
        queue.update_item_status(item["id"], "interrupted")
    print_report(overall_report)
    reset_terminal()
    sys.exit(0)


def main():
    parser = argparse.ArgumentParser(
        description="Audio and video transcription and indexing script"
    )
    parser.add_argument(
        "--force", action="store_true", help="Force re-transcription and re-indexing"
    )
    parser.add_argument(
        "-c",
        "--clear-vectors",
        action="store_true",
        help="Clear existing vectors before processing",
    )
    parser.add_argument(
        "--dryrun",
        action="store_true",
        help="Perform a dry run without sending data to Pinecone or S3",
    )
    parser.add_argument(
        "--override-conflicts",
        action="store_true",
        help="Continue processing even if filename conflicts are found",
    )
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

    items_to_process = []
    overall_report = {
        "processed": 0,
        "skipped": 0,
        "errors": 0,
        "error_details": [],
        "warnings": [],
        "fully_indexed": 0,
        "chunk_lengths": [],
    }

    with Pool(processes=4) as pool:
        signal_handler = partial(graceful_shutdown, pool, queue, items_to_process, overall_report)
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)

        try:
            while True:
                item = queue.get_next_item()
                if not item:
                    break

                items_to_process.append(item)

                if len(items_to_process) >= 4:
                    results = pool.starmap(process_item, [(item, args) for item in items_to_process])
                    for item_id, report in results:
                        queue.update_item_status(item_id, "completed" if report["errors"] == 0 else "error")
                        overall_report = merge_reports([overall_report, report])
                    items_to_process = []

            # Process any remaining items
            if items_to_process:
                results = pool.starmap(process_item, [(item, args) for item in items_to_process])
                for item_id, report in results:
                    queue.update_item_status(item_id, "completed" if report["errors"] == 0 else "error")
                    overall_report = merge_reports([overall_report, report])

        except Exception as e:
            logger.error(f"Error processing items: {str(e)}")
            logger.exception("Full traceback:")
            for item in items_to_process:
                queue.update_item_status(item["id"], "error")

    print("\nOverall Processing Report:")
    print_report(overall_report)

    queue_status = queue.get_queue_status()
    logger.info(f"Final queue status: {queue_status}")

    # Explicitly reset the terminal state
    reset_terminal()

if __name__ == "__main__":
    main()

# Add an extra newline at the very end of the file
print("")