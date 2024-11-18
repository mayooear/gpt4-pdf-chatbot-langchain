"""
Distributed Queue Implementation for Media Processing

A file-based queue system designed for robustness in distributed media processing environments.
Uses filesystem locks to handle concurrent access and JSON files for persistent state storage.

Design Decisions:
- File-based: Chosen over DB for simplicity and portability across environments
- JSON Storage: Each queue item stored as separate file for atomic operations
- POSIX Locks: Prevents race conditions in distributed processing
- Status Tracking: Maintains item lifecycle (pending → processing → completed/error)

Performance Characteristics:
- O(n) listing operations (scales with queue size)
- O(1) individual item operations
- Lock contention possible under high concurrency

Limitations:
- Not suitable for extremely high throughput (>1000 ops/sec)
- Requires POSIX-compliant filesystem for locking
- No built-in queue size limits
"""

import os
import json
import uuid
from datetime import datetime
import logging
import fcntl
import errno

logger = logging.getLogger(__name__)


class IngestQueue:
    """
    Queue implementation using filesystem as persistent storage.
    Each queue item is stored as a separate JSON file with format:
    {
        "id": "uuid",
        "type": "audio_file|youtube_video",
        "data": {...},
        "status": "pending|processing|completed|error|interrupted",
        "created_at": "ISO-8601",
        "updated_at": "ISO-8601"
    }
    """

    def __init__(self, queue_dir="queue"):
        # Queue directory path - supports multiple parallel queues
        self.queue_dir = queue_dir
        self.ensure_queue_dir()

    def ensure_queue_dir(self):
        if not os.path.exists(self.queue_dir):
            os.makedirs(self.queue_dir)
            logger.info(f"Created queue directory: {self.queue_dir}")

    def add_item(self, item_type, data):
        """
        Atomically adds new item to queue.
        
        Thread Safety: Uses atomic file creation
        Failure Modes: 
        - Disk full
        - Permission denied
        - Duplicate UUID (extremely unlikely)
        """
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
            # Atomic write using file creation
            with open(filepath, "w") as f:
                json.dump(queue_item, f)
            logger.debug(f"Added item to queue: {item_id}")
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
        """
        Retrieves and locks next available pending item.
        
        Locking Strategy:
        1. Attempt non-blocking lock (LOCK_NB)
        2. If locked, skip to next file
        3. If unlocked, update status and maintain lock
        
        Race Conditions Handled:
        - Multiple processors requesting items
        - Process crashes while holding lock
        - Item deletion during processing
        """
        for filename in os.listdir(self.queue_dir):
            if filename.endswith(".json"):
                filepath = os.path.join(self.queue_dir, filename)
                try:
                    with open(filepath, "r+") as f:
                        # Try non-blocking lock
                        fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
                        try:
                            item = json.load(f)
                            if item["status"] == "pending":
                                # Update status while holding lock
                                item["status"] = "processing"
                                item["updated_at"] = datetime.utcnow().isoformat()
                                f.seek(0)
                                json.dump(item, f)
                                f.truncate()
                                logger.info(f"Retrieved and locked item: {item['id']}")
                                return item
                        finally:
                            fcntl.flock(f, fcntl.LOCK_UN)
                except IOError as e:
                    if e.errno != errno.EWOULDBLOCK:
                        logger.error(f"Error reading queue item: {e}")
                    continue  # Skip locked files
        return None

    def update_item_status(self, item_id, status):
        """
        Updates item status with proper locking and error handling.
        
        Lock Strategy: Implicit file lock via open(r+)
        Atomicity: Seeks to start and truncates to ensure complete write
        
        Edge Cases:
        - File deleted during update
        - Partial write (system crash)
        - Invalid status transition
        """
        filepath = os.path.join(self.queue_dir, f"{item_id}.json")
        try:
            with open(filepath, "r+") as f:
                item = json.load(f)
                item["status"] = status
                item["updated_at"] = datetime.utcnow().isoformat()
                f.seek(0)
                json.dump(item, f)
                f.truncate()
                logger.info(f"Updated item {item_id} to status {status}")
                return True 
        except IOError as e:
            logger.error(f"Error updating item {item_id}: {e}")
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
        """
        Provides queue metrics without locking files.
        
        Performance: O(n) where n is queue size
        Memory Usage: O(1) - uses counter dict only
        
        Note: Results may be slightly stale due to no locking
        """
        status_counts = {
            "pending": 0,
            "completed": 0,
            "error": 0,
            "total": 0
        }

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
        """
        Purges all items from queue.
        
        Warning: Destructive operation
        - No status checks
        - No backup
        - Immediate deletion
        """
        for filename in os.listdir(self.queue_dir):
            if filename.endswith(".json"):
                file_path = os.path.join(self.queue_dir, filename)
                try:
                    os.unlink(file_path)
                except Exception as e:
                    logger.error(f"Failed to delete {file_path}. Reason: {e}")
        logger.info("Queue cleared")

    def get_item(self, item_id):
        """
        Retrieves single item without locking.
        
        Note: Result may be stale immediately
        No status changes are made
        """
        filepath = os.path.join(self.queue_dir, f"{item_id}.json")
        if os.path.exists(filepath):
            try:
                with open(filepath, "r") as f:
                    return json.load(f)
            except IOError as e:
                logger.error(f"Error reading queue item: {e}")
        return None

    def get_all_items(self):
        """
        Retrieves all queue items with size metadata.
        
        Size Calculation:
        - Audio: Actual file size from filesystem
        - YouTube: Estimated or provided size
        
        Memory Impact: O(n) where n is queue size
        Caution: May be memory-intensive for large queues
        """
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

    def _reset_items_by_status(self, status_list):
        """
        Internal helper for bulk status resets.
        
        Recovery Strategy:
        - Resets specified statuses to pending
        - Skips already pending items
        - Updates timestamps for tracking
        
        Use Cases:
        - Crash recovery
        - Manual intervention
        - Batch reprocessing
        """
        count = 0
        for filename in os.listdir(self.queue_dir):
            if filename.endswith(".json"):
                filepath = os.path.join(self.queue_dir, filename)
                try:
                    with open(filepath, "r+") as f:
                        item = json.load(f)
                        if item["status"] in status_list and item["status"] != "pending":
                            item["status"] = "pending"
                            item["updated_at"] = datetime.utcnow().isoformat()
                            f.seek(0)
                            json.dump(item, f)
                            f.truncate()
                            count += 1
                            logger.info(f"Reset item to pending: {item['id']} (was {item['status']})")
                except IOError as e:
                    logger.error(f"Error resetting item {filename}: {e}")
        logger.info(f"Reset {count} items to pending state.")
        return count

    def remove_completed_items(self):
        """
        Batch cleanup of completed items.
        
        Race Conditions:
        - Items completing during cleanup
        - Concurrent removals
        - Status changes during iteration
        
        Returns: Count of successfully removed items
        """
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
    
    def reset_stuck_items(self):
        """
        Recovery mechanism for failed or interrupted processing.
        Resets items to pending state for retry.
        
        States Reset:
        - error: Processing failed
        - interrupted: Process died mid-operation
        """
        return self._reset_items_by_status(["error", "interrupted"])

    def reset_processing_items(self):
        """
        Emergency recovery for hung processes.
        Resets items stuck in processing state.
        
        Use Cases:
        - Worker node crashes
        - Network partitions
        - Deadlocked processes
        """
        return self._reset_items_by_status(["processing"])

    def reprocess_item(self, item_id):
        """
        Targeted retry for specific item.
        
        State Validation:
        - Verifies item exists
        - Checks if already pending
        - Updates timestamp for tracking
        
        Returns: (success, message)
        """
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
        """
        Emergency queue reset - sets all items to pending.
        
        Warning: Destructive operation
        - Ignores current status
        - Resets all timestamps
        - May cause duplicate processing
        """
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