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
    for attempt in range(MAX_RETRIES):
        try:
            with open(ESTIMATES_FILE, 'r') as f:
                fcntl.flock(f, fcntl.LOCK_SH)  # Acquire a shared lock
                try:
                    content = f.read()
                    if not content.strip():  # Check if file is empty
                        logger.warning(f"Estimates file is empty. Returning default values.")
                        return {"audio_file": None, "youtube_video": None}
                    return json.loads(content)
                finally:
                    fcntl.flock(f, fcntl.LOCK_UN)  # Release the lock
        except json.JSONDecodeError as e:
            logger.error(f"Attempt {attempt + 1}: Error decoding JSON from {ESTIMATES_FILE}: {str(e)}")
        except IOError as e:
            logger.error(f"Attempt {attempt + 1}: IO Error reading {ESTIMATES_FILE}: {str(e)}")
        except Exception as e:
            logger.error(f"Attempt {attempt + 1}: Unexpected error reading {ESTIMATES_FILE}: {str(e)}")
        
        if attempt < MAX_RETRIES - 1:
            time.sleep(RETRY_DELAY)
    
    logger.warning(f"Failed to load estimates after {MAX_RETRIES} attempts. Returning default values.")
    return {"audio_file": None, "youtube_video": None}

def save_estimate(item_type, processing_time, file_size):
    estimates = load_estimates()
    
    # Check if item_type exists in estimates, if not initialize it
    if item_type not in estimates:
        estimates[item_type] = {"time": None, "size": None}
    
    if estimates[item_type]["time"] is None:
        estimates[item_type] = {"time": processing_time, "size": file_size}
    else:
        avg_time = estimates[item_type]["time"]
        avg_size = estimates[item_type]["size"]
        adjusted_time = (avg_time / avg_size) * file_size
        
        if processing_time > 3 * adjusted_time:
            logger.warning(f"Processing time {processing_time} for {item_type} is considered an outlier and will not be saved.")
        else:
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