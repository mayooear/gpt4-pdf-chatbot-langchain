import os
import json
import uuid
from datetime import datetime
import logging
import fcntl
import errno

logger = logging.getLogger(__name__)


class IngestQueue:
    def __init__(self, queue_dir="queue"):
        self.queue_dir = queue_dir
        self.ensure_queue_dir()

    def ensure_queue_dir(self):
        if not os.path.exists(self.queue_dir):
            os.makedirs(self.queue_dir)
            logger.info(f"Created queue directory: {self.queue_dir}")

    def add_item(self, item_type, data):
        item_id = str(uuid.uuid4())
        filename = f"{item_id}.json"
        filepath = os.path.join(self.queue_dir, filename)

        queue_item = {
            "id": item_id,
            "type": item_type,
            "data": data,
            "status": "pending",
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
        }

        try:
            with open(filepath, "w") as f:
                json.dump(queue_item, f)
            logger.info(f"Added item to queue: {item_id}")
            return item_id
        except IOError as e:
            logger.error(f"Error adding item to queue: {e}")
            return None

    def add_multiple_items(self, items):
        added_items = []
        for item_type, data in items:
            item_id = self.add_item(item_type, data)
            if item_id:
                added_items.append(item_id)
        return added_items

    def get_next_item(self):
        for filename in os.listdir(self.queue_dir):
            if filename.endswith(".json"):
                filepath = os.path.join(self.queue_dir, filename)
                try:
                    with open(filepath, "r+") as f:
                        fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
                        try:
                            item = json.load(f)
                            if item["status"] == "pending":
                                item["status"] = "processing"
                                item["updated_at"] = datetime.utcnow().isoformat()
                                f.seek(0)
                                json.dump(item, f)
                                f.truncate()
                                logger.info(
                                    f"Retrieved and locked next item from queue: {item['id']}"
                                )
                                return item
                        finally:
                            fcntl.flock(f, fcntl.LOCK_UN)
                except IOError as e:
                    if e.errno != errno.EWOULDBLOCK:
                        logger.error(f"Error reading queue item: {e}")
                    continue  # Move to the next file if this one is locked
        return None

    def update_item_status(self, item_id, status):
        filepath = os.path.join(self.queue_dir, f"{item_id}.json")
        if os.path.exists(filepath):
            try:
                with open(filepath, "r") as f:
                    item = json.load(f)
                item["status"] = status
                item["updated_at"] = datetime.utcnow().isoformat()
                with open(filepath, "w") as f:
                    json.dump(item, f)
                logger.info(f"Updated item status: {item_id} -> {status}")
                return True
            except IOError as e:
                logger.error(f"Error updating item status: {e}")
        else:
            logger.warning(f"Item not found: {item_id}")
        return False

    def remove_item(self, item_id):
        filepath = os.path.join(self.queue_dir, f"{item_id}.json")
        if os.path.exists(filepath):
            try:
                os.remove(filepath)
                logger.info(f"Removed item from queue: {item_id}")
                return True
            except IOError as e:
                logger.error(f"Error removing item from queue: {e}")
        else:
            logger.warning(f"Item not found: {item_id}")
        return False

    def get_queue_status(self):
        status_counts = {}

        for filename in os.listdir(self.queue_dir):
            if filename.endswith(".json"):
                filepath = os.path.join(self.queue_dir, filename)
                try:
                    with open(filepath, "r") as f:
                        item = json.load(f)
                    status = item.get("status", "unknown")
                    if status in status_counts:
                        status_counts[status] += 1
                    else:
                        status_counts[status] = 1
                except IOError as e:
                    logger.error(f"Error reading queue item: {e}")

        status_counts["total"] = sum(status_counts.values())
        return status_counts

    def clear_queue(self):
        """Remove all JSON items from the queue."""
        for filename in os.listdir(self.queue_dir):
            if filename.endswith(".json"):
                file_path = os.path.join(self.queue_dir, filename)
                try:
                    os.unlink(file_path)
                except Exception as e:
                    logger.error(f"Failed to delete {file_path}. Reason: {e}")
        logger.info("Queue cleared")

    def get_item(self, item_id):
        filepath = os.path.join(self.queue_dir, f"{item_id}.json")
        if os.path.exists(filepath):
            try:
                with open(filepath, "r") as f:
                    return json.load(f)
            except IOError as e:
                logger.error(f"Error reading queue item: {e}")
        return None

    def get_all_items(self):
        """Retrieve all items from the queue."""
        items = []
        for filename in os.listdir(self.queue_dir):
            if filename.endswith(".json"):
                filepath = os.path.join(self.queue_dir, filename)
                try:
                    with open(filepath, "r") as f:
                        item = json.load(f)
                        if item["type"] == "audio_file":
                            file_path = item["data"].get("file_path")
                            if file_path and os.path.exists(file_path):
                                item["file_size"] = os.path.getsize(file_path)
                        elif item["type"] == "youtube_video":
                            # For YouTube videos, use the size stored in the data, or a default size
                            item["file_size"] = item["data"].get("file_size", 100 * 1024 * 1024)  # Default to 100 MB if not available
                        items.append(item)
                except IOError as e:
                    logger.error(f"Error reading queue item {filename}: {e}")
        return items

    def reset_stuck_items(self):
        """Reset status to 'pending' for all items in 'error' or 'interrupted' state."""
        count = 0
        for filename in os.listdir(self.queue_dir):
            if filename.endswith(".json"):
                filepath = os.path.join(self.queue_dir, filename)
                try:
                    with open(filepath, "r") as f:
                        item = json.load(f)
                    if item["status"] in ["error", "interrupted"]:
                        item["status"] = "pending"
                        item["updated_at"] = datetime.utcnow().isoformat()
                        with open(filepath, "w") as f:
                            json.dump(item, f)
                        count += 1
                except IOError as e:
                    logger.error(f"Error resetting item {filename}: {e}")
        return count

    def remove_completed_items(self):
        """Remove all completed items from the queue."""
        removed_count = 0
        for filename in os.listdir(self.queue_dir):
            if filename.endswith(".json"):
                filepath = os.path.join(self.queue_dir, filename)
                try:
                    with open(filepath, "r") as f:
                        item = json.load(f)
                    if item["status"] == "completed":
                        item_id = item["id"]
                        if self.remove_item(item_id):
                            removed_count += 1
                except IOError as e:
                    logger.error(f"Error reading queue item {filename}: {e}")

        return removed_count

    def reprocess_item(self, item_id):
        item = self.get_item(item_id)
        if not item:
            logger.warning(f"Item not found: {item_id}")
            return False, "Item not found"
        
        if item["status"] == "pending":
            logger.warning(f"Item {item_id} is already pending. No action taken.")
            return False, "Item is already pending"
        
        item["status"] = "pending"
        item["updated_at"] = datetime.utcnow().isoformat()
        
        filepath = os.path.join(self.queue_dir, f"{item_id}.json")
        try:
            with open(filepath, "w") as f:
                json.dump(item, f)
            return True, f"Item reset for reprocessing: {item_id}"
        except IOError as e:
            logger.error(f"Error reprocessing item {item_id}: {e}")
            return False, f"Error reprocessing item: {e}"

    def reset_all_items(self):
        """Reset all items in the queue to 'pending' status."""
        for filename in os.listdir(self.queue_dir):
            if filename.endswith(".json"):
                filepath = os.path.join(self.queue_dir, filename)
                try:
                    with open(filepath, "r+") as f:
                        item = json.load(f)
                        item["status"] = "pending"
                        item["updated_at"] = datetime.utcnow().isoformat()
                        f.seek(0)
                        json.dump(item, f)
                        f.truncate()
                except IOError as e:
                    logger.error(f"Error resetting item {filename}: {e}")
        logger.info("All items in the queue have been reset to 'pending' status.")