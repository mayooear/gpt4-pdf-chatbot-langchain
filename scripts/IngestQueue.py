import os
import json
import uuid
from datetime import datetime
import logging
import shutil
import fcntl
import errno

logger = logging.getLogger(__name__)

class IngestQueue:
    def __init__(self, queue_dir='queue'):
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
            'id': item_id,
            'type': item_type,
            'data': data,
            'status': 'pending',
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        }
        
        try:
            with open(filepath, 'w') as f:
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
            if filename.endswith('.json'):
                filepath = os.path.join(self.queue_dir, filename)
                try:
                    with open(filepath, 'r+') as f:
                        fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
                        try:
                            item = json.load(f)
                            if item['status'] == 'pending':
                                item['status'] = 'processing'
                                item['updated_at'] = datetime.utcnow().isoformat()
                                f.seek(0)
                                json.dump(item, f)
                                f.truncate()
                                logger.info(f"Retrieved and locked next item from queue: {item['id']}")
                                return item
                        finally:
                            fcntl.flock(f, fcntl.LOCK_UN)
                except IOError as e:
                    if e.errno != errno.EWOULDBLOCK:
                        logger.error(f"Error reading queue item: {e}")
                    continue  # Move to the next file if this one is locked
        logger.info("No pending items in the queue")
        return None

    def update_item_status(self, item_id, status):
        filepath = os.path.join(self.queue_dir, f"{item_id}.json")
        if os.path.exists(filepath):
            try:
                with open(filepath, 'r') as f:
                    item = json.load(f)
                item['status'] = status
                item['updated_at'] = datetime.utcnow().isoformat()
                with open(filepath, 'w') as f:
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
        pending = 0
        completed = 0
        error = 0
        
        for filename in os.listdir(self.queue_dir):
            if filename.endswith('.json'):
                filepath = os.path.join(self.queue_dir, filename)
                try:
                    with open(filepath, 'r') as f:
                        item = json.load(f)
                    if item['status'] == 'pending':
                        pending += 1
                    elif item['status'] == 'completed':
                        completed += 1
                    elif item['status'] == 'error':
                        error += 1
                except IOError as e:
                    logger.error(f"Error reading queue item: {e}")
        
        return {
            'pending': pending,
            'completed': completed,
            'error': error,
            'total': pending + completed + error
        }

    def clear_queue(self):
        """Remove all JSON items from the queue."""
        for filename in os.listdir(self.queue_dir):
            if filename.endswith('.json'):
                file_path = os.path.join(self.queue_dir, filename)
                try:
                    os.unlink(file_path)
                except Exception as e:
                    logger.error(f'Failed to delete {file_path}. Reason: {e}')
        logger.info("Queue cleared")

    def get_item(self, item_id):
        filepath = os.path.join(self.queue_dir, f"{item_id}.json")
        if os.path.exists(filepath):
            try:
                with open(filepath, 'r') as f:
                    return json.load(f)
            except IOError as e:
                logger.error(f"Error reading queue item: {e}")
        return None

    def get_all_items(self):
        """Retrieve all items from the queue."""
        items = []
        for filename in os.listdir(self.queue_dir):
            if filename.endswith('.json'):
                filepath = os.path.join(self.queue_dir, filename)
                try:
                    with open(filepath, 'r') as f:
                        item = json.load(f)
                        items.append(item)
                except IOError as e:
                    logger.error(f"Error reading queue item {filename}: {e}")
        return items

    def reset_error_items(self):
        """Reset status to 'pending' for all items in 'error' or 'interrupted' state."""
        count = 0
        for filename in os.listdir(self.queue_dir):
            if filename.endswith('.json'):
                filepath = os.path.join(self.queue_dir, filename)
                try:
                    with open(filepath, 'r') as f:
                        item = json.load(f)
                    if item['status'] in ['error', 'interrupted']:
                        item['status'] = 'pending'
                        item['updated_at'] = datetime.utcnow().isoformat()
                        with open(filepath, 'w') as f:
                            json.dump(item, f)
                        count += 1
                except IOError as e:
                    logger.error(f"Error resetting item {filename}: {e}")
        return count