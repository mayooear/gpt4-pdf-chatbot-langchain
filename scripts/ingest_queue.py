import argparse
import os
from dotenv import load_dotenv
from IngestQueue import IngestQueue
from logging_utils import configure_logging
from youtube_utils import extract_youtube_id, get_channel_videos
from media_utils import get_file_hash
import logging

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
            if file.lower().endswith(('.mp3', '.wav', '.flac', '.mp4', '.avi', '.mov')):
                file_path = os.path.join(root, file)
                file_hash = get_file_hash(file_path)
                
                if file_hash in processed_hashes:
                    if file not in conflicts:
                        conflicts[file] = []
                    conflicts[file].append(file_path)
                else:
                    processed_hashes.add(file_hash)
    
    return conflicts

def process_directory(directory_path, queue, author, library):
    conflicts = check_unique_filenames(directory_path)
    if conflicts:
        logger.error("Filename conflicts found:")
        for file, locations in conflicts.items():
            logger.error(f"\n{file}:")
            for location in locations:
                logger.error(f"  - {location}")
        return False

    for root, _, files in os.walk(directory_path):
        for file in files:
            if file.lower().endswith('.mp3'):
                file_path = os.path.join(root, file)
                item_id = queue.add_item('audio_file', {
                    'file_path': file_path,
                    'author': author,
                    'library': library
                })
                if item_id:
                    logger.info(f"Added audio file to queue: {item_id} - {file_path}")
                else:
                    logger.error(f"Failed to add audio file to queue: {file_path}")
    
    return True

def add_to_queue(args, queue):
    if args.video:
        youtube_id = extract_youtube_id(args.video)
        if youtube_id:
            item_id = queue.add_item('youtube_video', {
                'url': args.video,
                'youtube_id': youtube_id,
                'author': args.author,
                'library': args.library
            })
            if item_id:
                logger.info(f"Added YouTube video to queue: {item_id}")
            else:
                logger.error("Failed to add YouTube video to queue")
        else:
            logger.error("Invalid YouTube video URL")

    elif args.channel:
        videos = get_channel_videos(args.channel)
        for video in videos:
            logger.debug(f"Video to add: {video}")
            item_id = queue.add_item('youtube_video', {
                'url': video['url'],
                'youtube_id': video['youtube_id'],
                'author': args.author,
                'library': args.library
            })
            if item_id:
                logger.info(f"Added YouTube video from channel to queue: {item_id}")
            else:
                logger.error(f"Failed to add YouTube video to queue: {video['url']}")

    elif args.audio:
        item_id = queue.add_item('audio_file', {
            'file_path': args.audio,
            'author': args.author,
            'library': args.library
        })
        if item_id:
            logger.info(f"Added audio file to queue: {item_id}")
        else:
            logger.error("Failed to add audio file to queue")

    elif args.directory:
        if process_directory(args.directory, queue, args.author, args.library):
            logger.info(f"Processed directory: {args.directory}")
        else:
            logger.error(f"Failed to process directory: {args.directory}")

    else:
        logger.error("No valid input provided for adding to queue")

def list_queue_items(queue):
    items = queue.get_all_items()
    if not items:
        print("The queue is empty.")
        return

    print("Queue contents:")
    # Determine the maximum lengths for each column dynamically
    max_id_len = max((len(str(item.get('id', 'Unknown ID'))) for item in items), default=10)
    max_type_len = max((len(item.get('type', 'Unknown type')) for item in items), default=15)
    max_status_len = max((len(item.get('status', 'Unknown status')) for item in items), default=15)
    max_url_len = max((len(item.get('data', {}).get('url', '')) for item in items if item.get('type') == 'youtube_video'), default=50)
    max_file_path_len = max((len(item.get('data', {}).get('file_path', '')) for item in items if item.get('type') == 'audio_file'), default=50)
    max_author_len = max((len(item.get('data', {}).get('author', '')) for item in items), default=20)
    max_library_len = max((len(item.get('data', {}).get('library', '')) for item in items), default=20)

    # Print the header with dynamic lengths and 2 spaces between columns
    print(f"{'ID'.ljust(max_id_len)}  {'Type'.ljust(max_type_len)}  {'Status'.ljust(max_status_len)}  {'URL/File'.ljust(max(max_url_len, max_file_path_len))}  {'Author'.ljust(max_author_len)}  {'Library'.ljust(max_library_len)}")
    
    for item in items:
        item_id = str(item.get('id', 'Unknown ID'))
        item_type = item.get('type', 'Unknown type')
        item_data = item.get('data', {})
        item_status = item.get('status', 'Unknown status')
        
        if item_type == 'youtube_video':
            print(f"{item_id.ljust(max_id_len)}  {item_type.ljust(max_type_len)}  {item_status.ljust(max_status_len)}  {item_data.get('url', '').ljust(max(max_url_len, max_file_path_len))}  {item_data.get('author', '').ljust(max_author_len)}  {item_data.get('library', '').ljust(max_library_len)}")
        elif item_type == 'audio_file':
            print(f"{item_id.ljust(max_id_len)}  {item_type.ljust(max_type_len)}  {item_status.ljust(max_status_len)}  {item_data.get('file_path', '').ljust(max(max_url_len, max_file_path_len))}  {item_data.get('author', '').ljust(max_author_len)}  {item_data.get('library', '').ljust(max_library_len)}")
        else:
            print(f"{item_id.ljust(max_id_len)}  {item_type.ljust(max_type_len)}  {item_status.ljust(max_status_len)}  {'N/A'.ljust(max(max_url_len, max_file_path_len))}  {'N/A'.ljust(max_author_len)}  {'N/A'.ljust(max_library_len)}")

def clear_queue(queue):
    queue.clear_queue()
    logger.info("Queue has been cleared")

def reset_error_items(queue):
    reprocessed_count = queue.reprocess_error_items()
    logger.info(f"Reset {reprocessed_count} items from error state. Ready for processing.")

def main():
    parser = argparse.ArgumentParser(description="Manage the ingest queue")
    
    # Add operation arguments
    parser.add_argument("--video", help="YouTube video URL")
    parser.add_argument("--channel", help="YouTube channel URL")
    parser.add_argument("--audio", help="Path to audio file")
    parser.add_argument("--directory", help="Path to directory containing audio files")
    parser.add_argument("--author", help="Author of the media")
    parser.add_argument("--library", help="Name of the library")
    parser.add_argument("--list", action="store_true", help="List all items in the processing queue")
    parser.add_argument("--clear", action="store_true", help="Clear all items from the queue")
    parser.add_argument("--reset", action="store_true", help="Reset items in error state to pending")
    parser.add_argument("--debug", action="store_true", help="Enable debug logging")

    args = parser.parse_args()

    logger = initialize_environment(args)
    queue = IngestQueue()

    if args.list:
        list_queue_items(queue)
    elif args.clear:
        clear_queue(queue)
    elif args.reset:
        reset_error_items(queue)
    elif any([args.video, args.channel, args.audio, args.directory]):
        if not args.author or not args.library:
            logger.error("For adding items, you must specify both --author and --library")
            parser.print_help()
            return
        add_to_queue(args, queue)
    else:
        logger.error("No valid operation specified. Use --list to view queue, --clear to clear queue, --reprocess to rerun error items, or provide input for adding items.")
        parser.print_help()
        return

    queue_status = queue.get_queue_status()
    logger.info(f"Queue status: {queue_status}")

if __name__ == "__main__":
    main()