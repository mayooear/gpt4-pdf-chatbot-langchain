import argparse
from datetime import timedelta
import os
from dotenv import load_dotenv
from IngestQueue import IngestQueue
from logging_utils import configure_logging
from youtube_utils import extract_youtube_id, get_playlist_videos
from media_utils import get_file_hash
import logging
from processing_time_estimates import save_estimate, get_estimate, estimate_total_processing_time

logger = logging.getLogger(__name__)


def initialize_environment(args):
    load_dotenv()
    logger = configure_logging(args.debug)
    return logger


def check_unique_filenames(directory_path):
    conflicts = {}
    processed_hashes = set()

    for root, _, files in os.walk(directory_path):
        for file in files:
            if file.lower().endswith((".mp3", ".wav", ".flac", ".mp4", ".avi", ".mov")):
                file_path = os.path.join(root, file)
                file_hash = get_file_hash(file_path)

                if file_hash in processed_hashes:
                    if file not in conflicts:
                        conflicts[file] = []
                    conflicts[file].append(file_path)
                else:
                    processed_hashes.add(file_hash)

    return conflicts


def process_audio_input(input_path, queue, author, library):
    if os.path.isfile(input_path):
        if input_path.lower().endswith((".mp3", ".wav", ".flac")):
            item_id = queue.add_item(
                "audio_file",
                {"file_path": input_path, "author": author, "library": library},
            )
            if item_id:
                logger.info(f"Added audio file to queue: {item_id} - {input_path}")
                return [item_id]
            else:
                logger.error(f"Failed to add audio file to queue: {input_path}")
                return []
        else:
            logger.error(f"Unsupported file type: {input_path}")
            return []
    elif os.path.isdir(input_path):
        return process_directory(input_path, queue, author, library)
    else:
        logger.error(f"Invalid input path: {input_path}")
        return []


def process_directory(directory_path, queue, author, library):
    conflicts = check_unique_filenames(directory_path)
    if conflicts:
        logger.error("Filename conflicts found:")
        for file, locations in conflicts.items():
            logger.error(f"\n{file}:")
            for location in locations:
                logger.error(f"  - {location}")
        return []

    added_items = []
    for root, _, files in os.walk(directory_path):
        for file in files:
            if file.lower().endswith((".mp3", ".wav", ".flac")):
                file_path = os.path.join(root, file)
                item_id = queue.add_item(
                    "audio_file",
                    {"file_path": file_path, "author": author, "library": library},
                )
                if item_id:
                    logger.info(f"Added audio file to queue: {item_id} - {file_path}")
                    added_items.append(item_id)
                else:
                    logger.error(f"Failed to add audio file to queue: {file_path}")

    return added_items


def add_to_queue(args, queue):
    if args.video:
        youtube_id = extract_youtube_id(args.video)
        if youtube_id:
            item_id = queue.add_item(
                "youtube_video",
                {
                    "url": args.video,
                    "youtube_id": youtube_id,
                    "author": args.author,
                    "library": args.library,
                },
            )
            if item_id:
                logger.info(f"Added YouTube video to queue: {item_id}")
            else:
                logger.error("Failed to add YouTube video to queue")
        else:
            logger.error("Invalid YouTube video URL")

    elif args.playlist:
        videos = get_playlist_videos(args.playlist)
        for video in videos:
            logger.debug(f"Video to add: {video}")
            item_id = queue.add_item(
                "youtube_video",
                {
                    "url": video["url"],
                    "youtube_id": video["youtube_id"],
                    "author": args.author,
                    "library": args.library,
                },
            )
            if item_id:
                logger.info(f"Added YouTube video from playlist to queue: {item_id}")
            else:
                logger.error(f"Failed to add YouTube video to queue: {video['url']}")

    elif args.audio or args.directory:
        input_path = args.audio or args.directory
        added_items = process_audio_input(input_path, queue, args.author, args.library)
        if added_items:
            logger.info(f"Added {len(added_items)} audio file(s) to queue")
        else:
            logger.error(f"Failed to add any audio files from: {input_path}")

    else:
        logger.error("No valid input provided for adding to queue")


def truncate_path(file_path, num_dirs=3):
    """Return the last `num_dirs` directories of a file path."""
    parts = file_path.split(os.sep)
    return os.sep.join(parts[-num_dirs - 1 :]) if len(parts) > num_dirs else file_path


def list_queue_items(queue):
    items = queue.get_all_items()
    if not items:
        print("The queue is empty.")
        return

    print("Queue contents:")
    # Determine the maximum lengths for each column dynamically
    max_id_len = max(
        (len(str(item.get("id", "Unknown ID"))) for item in items), default=10
    )
    max_type_len = max(
        (len(item.get("type", "Unknown type")) for item in items), default=15
    )
    max_status_len = max(
        (len(item.get("status", "Unknown status")) for item in items), default=15
    )
    max_url_len = max(
        (
            len(item.get("data", {}).get("url", ""))
            for item in items
            if item.get("type") == "youtube_video"
        ),
        default=50,
    )
    max_file_path_len = max(
        (
            len(truncate_path(item.get("data", {}).get("file_path", "")))
            for item in items
            if item.get("type") == "audio_file"
        ),
        default=50,
    )
    max_author_len = max(
        (len(item.get("data", {}).get("author", "")) for item in items), default=20
    )
    max_library_len = max(
        (len(item.get("data", {}).get("library", "")) for item in items), default=20
    )

    # Print the header with dynamic lengths and 2 spaces between columns
    print(
        f"{'ID'.ljust(max_id_len)}  {'Type'.ljust(max_type_len)}  {'Status'.ljust(max_status_len)}  {'URL/File'.ljust(max(max_url_len, max_file_path_len))}  {'Author'.ljust(max_author_len)}  {'Library'.ljust(max_library_len)}"
    )

    for item in items:
        item_id = str(item.get("id", "Unknown ID"))
        item_type = item.get("type", "Unknown type")
        item_data = item.get("data", {})
        item_status = item.get("status", "Unknown status")

        if item_type == "youtube_video":
            print(
                f"{item_id.ljust(max_id_len)}  {item_type.ljust(max_type_len)}  {item_status.ljust(max_status_len)}  {item_data.get('url', '').ljust(max(max_url_len, max_file_path_len))}  {item_data.get('author', '').ljust(max_author_len)}  {item_data.get('library', '').ljust(max_library_len)}"
            )
        elif item_type == "audio_file":
            truncated_path = truncate_path(item_data.get("file_path", ""))
            print(
                f"{item_id.ljust(max_id_len)}  {item_type.ljust(max_type_len)}  {item_status.ljust(max_status_len)}  {truncated_path.ljust(max(max_url_len, max_file_path_len))}  {item_data.get('author', '').ljust(max_author_len)}  {item_data.get('library', '').ljust(max_library_len)}"
            )
        else:
            print(
                f"{item_id.ljust(max_id_len)}  {item_type.ljust(max_type_len)}  {item_status.ljust(max_status_len)}  {'N/A'.ljust(max(max_url_len, max_file_path_len))}  {'N/A'.ljust(max_author_len)}  {'N/A'.ljust(max_library_len)}"
            )

    estimated_time = estimate_total_processing_time(items)
    print(f"\nEstimated time to complete all pending items: {estimated_time}")

    # Add individual estimates for audio and video
    audio_estimate = get_estimate("audio_file")
    video_estimate = get_estimate("youtube_video")
    if audio_estimate:
        print(f"Average processing time for audio files: {timedelta(seconds=int(audio_estimate['time']))} for {audio_estimate['size'] / (1024*1024):.2f} MB")
    if video_estimate:
        print(f"Average processing time for YouTube videos: {timedelta(seconds=int(video_estimate['time']))} for {video_estimate['size'] / (1024*1024):.2f} MB")


def clear_queue(queue):
    queue.clear_queue()
    logger.info("Queue has been cleared")


def reset_stuck_items(queue):
    reset_count = queue.reset_stuck_items()
    logger.info(
        f"Reset {reset_count} items from error or interrupted state. Ready for processing."
    )


def remove_completed_items(queue):
    removed_count = queue.remove_completed_items()
    logger.info(f"Removed {removed_count} completed items from the queue")


def reprocess_item(queue, item_id):
    success, message = queue.reprocess_item(item_id)
    if success:
        logger.info(message)
    else:
        logger.warning(message)


def reprocess_all_items(queue):
    reset_count = queue.reset_all_items()
    logger.info(f"Reset all {reset_count} items in the queue. Ready for reprocessing.")


def main():
    parser = argparse.ArgumentParser(description="Manage the ingest queue")

    # Add operation arguments
    parser.add_argument("--video", help="YouTube video URL")
    parser.add_argument("--playlist", help="YouTube playlist URL")
    parser.add_argument("--audio", help="Path to audio file")
    parser.add_argument("--directory", help="Path to directory containing audio files")
    parser.add_argument("--author", help="Author of the media")
    parser.add_argument("--library", help="Name of the library")
    parser.add_argument(
        "--list", action="store_true", help="List all items in the processing queue"
    )
    parser.add_argument(
        "--clear", action="store_true", help="Clear all items from the queue"
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Reset items in error or interrupted state to pending",
    )
    parser.add_argument(
        "--remove-completed",
        action="store_true",
        help="Remove all completed items from the queue",
    )
    parser.add_argument("--debug", action="store_true", help="Enable debug logging")
    parser.add_argument("--reprocess", help="Reprocess a specific item by ID")
    parser.add_argument(
        "--reprocess-all",
        action="store_true",
        help="Reset all items in the queue for reprocessing",
    )

    args = parser.parse_args()

    logger = initialize_environment(args)
    queue = IngestQueue()

    if args.reprocess_all:
        reprocess_all_items(queue)
    elif args.reprocess:
        reprocess_item(queue, args.reprocess)
    elif args.list:
        list_queue_items(queue)
    elif args.clear:
        clear_queue(queue)
    elif args.reset:
        reset_stuck_items(queue)
    elif args.remove_completed:
        remove_completed_items(queue)
    elif any([args.video, args.playlist, args.audio, args.directory]):
        if not args.author or not args.library:
            logger.error(
                "For adding items, you must specify both --author and --library"
            )
            parser.print_help()
            return
        add_to_queue(args, queue)
    else:
        logger.error("No valid operation specified.")
        parser.print_help()
        return

    queue_status = queue.get_queue_status()
    print(f"Queue status: {queue_status}")


if __name__ == "__main__":
    main()