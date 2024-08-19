import json
import os
from datetime import timedelta
import logging
import time
import fcntl

logger = logging.getLogger(__name__)
ESTIMATES_FILE = 'data/processing_time_estimates.json'
MAX_RETRIES = 3
RETRY_DELAY = 0.1  # seconds

def load_estimates():
    # Ensure the directory exists
    os.makedirs(os.path.dirname(ESTIMATES_FILE), exist_ok=True)

    for attempt in range(MAX_RETRIES):
        try:
            # Try to open the file in read mode, create it if it doesn't exist
            with open(ESTIMATES_FILE, 'a+') as f:
                fcntl.flock(f, fcntl.LOCK_EX)  # Acquire an exclusive lock
                try:
                    f.seek(0)  # Move to the beginning of the file
                    content = f.read()
                    if not content.strip():  # Check if file is empty
                        logger.info(f"Estimates file is empty or doesn't exist. Creating with default values.")
                        default_estimates = {"audio_file": {"time": None, "size": None}, "youtube_video": {"time": None, "size": None}}
                        json.dump(default_estimates, f)
                        return default_estimates
                    f.seek(0)  # Reset file pointer to beginning
                    return json.load(f)
                finally:
                    fcntl.flock(f, fcntl.LOCK_UN)  # Release the lock
        except json.JSONDecodeError as e:
            logger.error(f"Attempt {attempt + 1}: Error decoding JSON from {ESTIMATES_FILE}: {str(e)}")
        except IOError as e:
            logger.error(f"Attempt {attempt + 1}: IO Error accessing {ESTIMATES_FILE}: {str(e)}")
        except Exception as e:
            logger.error(f"Attempt {attempt + 1}: Unexpected error accessing {ESTIMATES_FILE}: {str(e)}")
        
        if attempt < MAX_RETRIES - 1:
            time.sleep(RETRY_DELAY)
    
    logger.warning(f"Failed to load estimates after {MAX_RETRIES} attempts. Returning default values.")
    return {"audio_file": {"time": None, "size": None}, "youtube_video": {"time": None, "size": None}}

def save_estimate(item_type, processing_time, file_size):
    estimates = load_estimates()
    
    # Initialize the estimate for the item_type if it doesn't exist or is None
    if item_type not in estimates or estimates[item_type] is None:
        estimates[item_type] = {"time": None, "size": None}
    
    if estimates[item_type]["time"] is None:
        estimates[item_type] = {"time": processing_time, "size": file_size}
    else:
        avg_time = estimates[item_type]["time"]
        avg_size = estimates[item_type]["size"]
        estimates[item_type]["time"] = (avg_time + processing_time) / 2
        estimates[item_type]["size"] = (avg_size + file_size) / 2
    
    with open(ESTIMATES_FILE, 'w') as f:
        json.dump(estimates, f)

def get_estimate(item_type):
    estimates = load_estimates()
    return estimates.get(item_type)

def estimate_total_processing_time(items):
    num_processes = 4  # assume 4 processes for now
    estimates = load_estimates()
    total_time = 0
    for item in items:
        if item["status"] != "completed":
            if item["type"] in ["audio_file", "youtube_video"]:
                estimate = estimates.get(item["type"])
                if estimate:
                    file_size = item.get("file_size")
                    if file_size is None:
                        # If file_size is not available, use the average size from estimates
                        file_size = estimate["size"]
                    # Use the simple moving average
                    avg_time = estimate["time"]
                    avg_size = estimate["size"]
                    total_time += (avg_time / avg_size) * file_size
    return timedelta(seconds=int(total_time/num_processes))