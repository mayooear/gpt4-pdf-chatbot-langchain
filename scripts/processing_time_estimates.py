import json
import os
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)
ESTIMATES_FILE = 'data/processing_time_estimates.json'

def load_estimates():
    if os.path.exists(ESTIMATES_FILE):
        with open(ESTIMATES_FILE, 'r') as f:
            return json.load(f)
    return {"audio_file": None, "youtube_video": None}

def save_estimate(item_type, processing_time, file_size):
    estimates = load_estimates()
    if estimates[item_type] is None:
        estimates[item_type] = {"time": processing_time, "size": file_size}
    else:
        estimates[item_type]["time"] = (estimates[item_type]["time"] + processing_time) / 2
        estimates[item_type]["size"] = (estimates[item_type]["size"] + file_size) / 2
    with open(ESTIMATES_FILE, 'w') as f:
        json.dump(estimates, f)

def get_estimate(item_type):
    estimates = load_estimates()
    return estimates.get(item_type)

def estimate_total_processing_time(items):
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
    return timedelta(seconds=int(total_time))