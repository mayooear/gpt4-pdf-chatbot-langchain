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

logger = logging.getLogger(__name__)


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
                    store_in_pinecone(
                        index,
                        chunks,
                        embeddings,
                        file_path,
                        author,
                        library_name,
                        is_youtube_video,
                        youtube_id,
                    )
                except AuthenticationError as e:
                    error_msg = f"Error creating embeddings for {'YouTube video' if is_youtube_video else 'file'} {file_name}: {str(e)}"
                    logger.error(error_msg)
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


def process_audio_file(item, args):
    """process audio file in a separate process"""

    # Initialize resources for this process
    client = OpenAI()
    index = load_pinecone()

    file_to_process = item["data"]["file_path"]
    author = item["data"]["author"]
    library = item["data"]["library"]

    report = process_file(
        file_to_process,
        index,
        client,
        args.force,
        dryrun=args.dryrun,
        author=author,
        library_name=library,
        is_youtube_video=False,
        youtube_data=None,
    )

    # Clean up resources if necessary
    # (e.g., close connections, etc.)

    return item["id"], report


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
        existing_transcription = get_transcription(
            None, is_youtube_video=True, youtube_id=youtube_id
        )
        if existing_transcription:
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


def process_audio_batch(audio_files, args, pool, queue):
    try:
        results = pool.starmap(
            process_audio_file, [(file, args) for file in audio_files]
        )
        combined_report = merge_reports([report for _, report in results])
        print_report(combined_report)
        for item_id, _ in results:
            queue.update_item_status(item_id, "completed")
        return combined_report
    except Exception as e:
        logger.error(f"Error in audio file batch processing: {str(e)}")
        logger.exception("Full traceback:")
        for audio_item in audio_files:
            queue.update_item_status(audio_item["id"], "error")
        return None


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

    failed_youtube_attempts = 0  # Initialize the counter

    audio_files = []
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
        try:
            while True:
                item = queue.get_next_item()
                if not item:
                    break

                if item["type"] == "audio_file":
                    audio_files.append(item)
                elif item["type"] == "youtube_video":
                    # Process YouTube videos sequentially as before
                    logger.debug("Processing YouTube video")
                    youtube_data = item["data"]
                    logger.debug(f"YouTube data: {youtube_data}")
                    logger.debug(f"YouTube URL: {youtube_data.get('url')}")
                    logger.debug(f"YouTube ID: {youtube_data.get('youtube_id')}")
                    logger.debug(f"Author: {youtube_data.get('author')}")
                    logger.debug(f"Library: {youtube_data.get('library')}")

                    youtube_data, youtube_id = process_youtube_video(
                        item["data"]["url"], logger
                    )
                    if not youtube_data:
                        logger.error("Failed to process YouTube video.")
                        queue.update_item_status(item["id"], "error")
                        failed_youtube_attempts += 1  # Increment the counter
                        if failed_youtube_attempts >= 3:
                            logger.error(
                                "Exiting script after 3 failed YouTube video processing attempts."
                            )
                            sys.exit(1)  # Exit the script
                        continue

                    logger.debug(f"Processed YouTube data: {youtube_data}")
                    logger.debug(f"Processed YouTube ID: {youtube_id}")

                    file_to_process = youtube_data["audio_path"]
                    is_youtube_video = True
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

                    logger.debug(f"Processing report: {report}")

                    if is_youtube_video and file_to_process:
                        if os.path.exists(file_to_process):
                            os.remove(file_to_process)
                            logger.info(
                                f"Deleted temporary YouTube audio file: {file_to_process}"
                            )

                    print_report(report)
                    queue.update_item_status(item["id"], "completed")

                    # Reset the counter on successful processing
                    failed_youtube_attempts = 0

                if len(audio_files) >= 4:
                    batch_report = process_audio_batch(audio_files, args, pool, queue)
                    if batch_report:
                        overall_report = merge_reports([overall_report, batch_report])
                    audio_files = []

            # Process any remaining audio files
            if audio_files:
                batch_report = process_audio_batch(audio_files, args, pool, queue)
                if batch_report:
                    overall_report = merge_reports([overall_report, batch_report])

        except KeyboardInterrupt:
            logger.info("\nKeyboard interrupt. Exiting.")
            for audio_item in audio_files:
                queue.update_item_status(audio_item["id"], "interrupted")
            if "item" in locals() and item["type"] == "youtube_video":
                queue.update_item_status(item["id"], "interrupted")
                if "file_to_process" in locals() and os.path.exists(file_to_process):
                    os.remove(file_to_process)
                    logger.info(
                        f"Deleted temporary YouTube audio file due to interruption: {file_to_process}"
                    )
            print_report(overall_report)
            sys.exit(0)

        except Exception as e:
            logger.error(f"Error processing item {item['id']}: {str(e)}")
            logger.exception("Full traceback:")
            queue.update_item_status(item["id"], "error")

    print("\nOverall Processing Report:")
    print_report(overall_report)

    queue_status = queue.get_queue_status()
    logger.info(f"Final queue status: {queue_status}")


if __name__ == "__main__":
    main()
