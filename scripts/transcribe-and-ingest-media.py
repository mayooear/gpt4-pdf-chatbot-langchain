#!/usr/bin/env python
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
    chunk_transcription,
    get_saved_transcription,
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
from s3_utils import upload_to_s3, S3UploadError
from youtube_utils import download_youtube_audio, extract_youtube_id
from multiprocessing import Pool, cpu_count, Queue, Event
import atexit
import signal
from functools import partial
from processing_time_estimates import save_estimate
import time
from queue import Empty  

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

    existing_transcription = get_saved_transcription(file_path, is_youtube_video, youtube_id)
    if existing_transcription and not force:
        transcription = existing_transcription
        local_report["skipped"] += 1
        logger.debug(f"Using existing transcription for {file_name}")
    else:
        logger.info(
            f"\nTranscribing {'YouTube video' if is_youtube_video else 'audio'} for {file_name}"
        )
        try:
            transcription = transcribe_media(
                file_path, force, is_youtube_video, youtube_id
            )
            if transcription:
                local_report["processed"] += 1
                if is_youtube_video:
                    save_youtube_transcription(youtube_data, file_path, transcription)
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

        logger.info(f"Processing transcripts for {file_name}")
        chunks = chunk_transcription(transcription)
        local_report["chunk_lengths"].extend(
            [len(chunk["words"]) for chunk in chunks]
        )
        if not dryrun:
            try:
                embeddings = create_embeddings(chunks, client)
                logger.debug(f"{len(embeddings)} embeddings created for {file_name}")
                
                # Use youtube_data for metadata if it's a YouTube video
                if is_youtube_video and youtube_data and "media_metadata" in youtube_data:
                    metadata = youtube_data["media_metadata"]
                    title = metadata.get("title", "Unknown Title")
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
            try:
                upload_to_s3(file_path)
            except S3UploadError as e:
                error_msg = f"Error uploading {file_name} to S3: {str(e)}"
                logger.error(error_msg)
                local_report["errors"] += 1
                local_report["error_details"].append(error_msg)
                return local_report

        local_report["fully_indexed"] += 1

    except Exception as e:
        error_msg = f"Error processing {'YouTube video' if is_youtube_video else 'file'} {file_name}: {str(e)}"
        logger.error(error_msg, exc_info=True)
        local_report["errors"] += 1
        local_report["error_details"].append(error_msg)

    return local_report


def worker(task_queue, result_queue, args, stop_event):
    client = OpenAI()
    index = load_pinecone()
    
    while not stop_event.is_set():
        try:
            item = task_queue.get(timeout=1)
            if item is None:
                break
            
            logging.debug(f"Worker processing item: {item}")
            item_id, report = process_item(item, args, client, index)
            result_queue.put((item_id, report))
        except Empty:
            continue
        except Exception as e:
            logging.error(f"Worker error: {str(e)}")
            result_queue.put((None, {"errors": 1, "error_details": [str(e)]}))


def process_item(item, args, client, index):
    """Process a media item (audio file or YouTube video) in a separate process"""
    # Ensure logging is configured for this process
    configure_logging(args.debug)
    logger = logging.getLogger(__name__)
    logger.debug(f"Processing item: {item}")

    logger.debug(f"Processing item: {item}")

    error_report = {
        "processed": 0,
        "skipped": 0,
        "errors": 1,
        "error_details": [],
        "warnings": [],
        "fully_indexed": 0,
        "chunk_lengths": [],
    }

    if item["type"] == "audio_file":
        file_to_process = item["data"]["file_path"]
        is_youtube_video = False
        youtube_data = None
    elif item["type"] == "youtube_video":
        youtube_data, youtube_id = preprocess_youtube_video(item["data"]["url"], logger)
        if not youtube_data:
            logger.error(f"Failed to process YouTube video: {item['data']['url']}")
            error_report["error_details"].append(f"Failed to process YouTube video: {item['data']['url']}")
            return item["id"], error_report
        # This may be None if transcript was cached
        file_to_process = youtube_data["audio_path"]
        is_youtube_video = True
    else:
        logger.error(f"Unknown item type: {item['type']}")
        error_report["error_details"].append(f"Unknown item type: {item['type']}")
        return item["id"], error_report

    logger.debug(f"File to process: {file_to_process}")

    author = item["data"]["author"]
    library = item["data"]["library"]
    logger.debug(f"Author: {author}")
    logger.debug(f"Library: {library}")

    start_time = time.time()
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
    end_time = time.time()
    processing_time = end_time - start_time

    if file_to_process:
        # Save the processing time estimate
        file_size = os.path.getsize(file_to_process)
        save_estimate(item["type"], processing_time, file_size)

    # Clean up temporary YouTube audio file if necessary
    if is_youtube_video and file_to_process and os.path.exists(file_to_process):
        os.remove(file_to_process)
        logger.info(f"Deleted temporary YouTube audio file: {file_to_process}")

    return item["id"], report


def initialize_environment(args):
    load_dotenv()
    init_db()
    configure_logging(args.debug)
    return logger


def preprocess_youtube_video(url, logger):
    youtube_id = extract_youtube_id(url)
    youtube_data_map = load_youtube_data_map()
    existing_youtube_data = youtube_data_map.get(youtube_id)

    if existing_youtube_data:
        # Clear bogus audio_path from existing youtube data
        existing_youtube_data["audio_path"] = None

        existing_transcription = get_saved_transcription(
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
            combined_report[key] += report.get(key, 0)
        combined_report["error_details"].extend(report.get("error_details", []))
        combined_report["warnings"].extend(report.get("warnings", []))
        combined_report["chunk_lengths"].extend(report.get("chunk_lengths", []))
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

    initialize_environment(args)
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


    overall_report = {
        "processed": 0,
        "skipped": 0,
        "errors": 0,
        "error_details": [],
        "warnings": [],
        "fully_indexed": 0,
        "chunk_lengths": [],
    }

    task_queue = Queue()
    result_queue = Queue()
    stop_event = Event()
    items_to_process = []  # Initialize the list to track items being processed

    num_processes = min(4, cpu_count())
    with Pool(processes=num_processes, initializer=worker, initargs=(task_queue, result_queue, args, stop_event)) as pool:
        def graceful_shutdown(signum, frame):
            logging.info("\nReceived interrupt signal. Shutting down gracefully...")
            stop_event.set()
            for _ in range(num_processes):
                task_queue.put(None)
            pool.close()
            pool.join()
            for item in items_to_process:
                queue.update_item_status(item["id"], "interrupted")
            print_report(overall_report)
            reset_terminal()
            sys.exit(0)

        signal.signal(signal.SIGINT, graceful_shutdown)
        signal.signal(signal.SIGTERM, graceful_shutdown)

        total_items = 0  # Track the total number of items
        items_processed = 0

        try:
            # Initially fill the task queue with the number of processes
            for _ in range(num_processes):
                item = queue.get_next_item()
                if not item:
                    break
                task_queue.put(item)
                items_to_process.append(item)  # Track the item being processed
                total_items += 1  # Increment the count for each item added

            with tqdm(total=total_items, desc="Processing items") as pbar:
                while items_processed < total_items:
                    try:
                        item_id, report = result_queue.get(timeout=120)
                        if item_id is not None:
                            queue.update_item_status(item_id, "completed" if report["errors"] == 0 else "error")
                            items_to_process = [item for item in items_to_process if item["id"] != item_id]  # Remove processed item
                        overall_report = merge_reports([overall_report, report])
                        items_processed += 1
                        pbar.update(1)

                        # Fetch and add a new item to the task queue
                        item = queue.get_next_item()
                        if item:
                            task_queue.put(item)
                            items_to_process.append(item)  # Track the new item being processed
                            total_items += 1  # Increment the count for each new item added

                    except Empty:
                        logging.warning("Main loop: Timeout while waiting for results. Continuing...")

        except Exception as e:
            logging.error(f"Error processing items: {str(e)}")
            logging.exception("Full traceback:")

    print("\nOverall Processing Report:")
    print_report(overall_report)

    queue_status = queue.get_queue_status()
    logging.info(f"Final queue status: {queue_status}")

    # Explicitly reset the terminal state
    reset_terminal()

if __name__ == "__main__":
    main()

# Add an extra newline at the very end of the file
print("")