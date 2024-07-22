import unittest
import os
import sys
import json
import shutil
from IngestQueue import IngestQueue

# Add the parent directory (scripts/) to the Python path
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(parent_dir)

# Centralized test data
TEST_AUDIO_FILE_1 = "../media/media/unit-test-data/how-to-commune-with-god.mp3"
TEST_AUDIO_FILE_2 = (
    "../media/media/unit-test-data/Treasures/01 Creativity & Initiative.mp3"
)
TEST_YOUTUBE_URL = "https://youtu.be/2s77yXNPwb0?si=abjnjhhBj9qGE1IY"
TEST_AUTHOR = "Swami Kriyananda"
TEST_LIBRARY = "Treasures"


class TestIngestQueue(unittest.TestCase):
    def setUp(self):
        self.test_queue_dir = "test_queue"
        self.queue = IngestQueue(self.test_queue_dir)
        self.queue.clear_queue()

    def tearDown(self):
        if os.path.exists(self.test_queue_dir):
            shutil.rmtree(self.test_queue_dir)

    def test_add_item(self):
        item_type = "audio_file"
        data = {
            "file_path": TEST_AUDIO_FILE_1,
            "author": TEST_AUTHOR,
            "library": TEST_LIBRARY,
        }
        item_id = self.queue.add_item(item_type, data)

        self.assertIsNotNone(item_id)
        self.assertTrue(
            os.path.exists(os.path.join(self.test_queue_dir, f"{item_id}.json"))
        )

        with open(os.path.join(self.test_queue_dir, f"{item_id}.json"), "r") as f:
            stored_item = json.load(f)

        self.assertEqual(stored_item["type"], item_type)
        self.assertEqual(stored_item["data"], data)
        self.assertEqual(stored_item["status"], "pending")

    def test_get_next_item(self):
        # Add a few items
        item1_id = self.queue.add_item(
            "audio_file",
            {
                "file_path": TEST_AUDIO_FILE_1,
                "author": TEST_AUTHOR,
                "library": TEST_LIBRARY,
            },
        )
        item2_id = self.queue.add_item(
            "youtube_video",
            {"url": TEST_YOUTUBE_URL, "author": TEST_AUTHOR, "library": TEST_LIBRARY},
        )
        item3_id = self.queue.add_item(
            "audio_file",
            {
                "file_path": TEST_AUDIO_FILE_2,
                "author": TEST_AUTHOR,
                "library": TEST_LIBRARY,
            },
        )

        print(f"Added items: {item1_id}, {item2_id}, {item3_id}")

        # Get and process all items
        processed_items = []
        while True:
            item = self.queue.get_next_item()
            if item is None:
                break
            processed_items.append(item)
            self.queue.update_item_status(item["id"], "processing")

        print(f"Processed items: {[item['id'] for item in processed_items]}")

        # Update all items to 'completed'
        for item_id in [item1_id, item2_id, item3_id]:
            update_result = self.queue.update_item_status(item_id, "completed")
            print(f"Update result for {item_id}: {update_result}")

        # Check status of each item
        for item_id in [item1_id, item2_id, item3_id]:
            item = self.queue.get_item(item_id)
            print(f"Item {item_id} status: {item['status'] if item else 'Not found'}")

        # Verify that there are no more pending items
        item4 = self.queue.get_next_item()
        self.assertIsNone(item4, f"Unexpected item found: {item4}")

        # Double-check the queue status
        status = self.queue.get_queue_status()
        print(f"Final queue status: {status}")
        self.assertEqual(status["pending"], 0)
        self.assertEqual(status["completed"], 3)
        self.assertEqual(status["error"], 0)
        self.assertEqual(status["total"], 3)

    def test_update_item_status(self):
        item_id = self.queue.add_item(
            "audio_file",
            {
                "file_path": TEST_AUDIO_FILE_1,
                "author": TEST_AUTHOR,
                "library": TEST_LIBRARY,
            },
        )
        self.queue.update_item_status(item_id, "completed")

        with open(os.path.join(self.test_queue_dir, f"{item_id}.json"), "r") as f:
            stored_item = json.load(f)
        self.assertEqual(stored_item["status"], "completed")

    def test_remove_item(self):
        item_id = self.queue.add_item(
            "audio_file",
            {
                "file_path": TEST_AUDIO_FILE_1,
                "author": TEST_AUTHOR,
                "library": TEST_LIBRARY,
            },
        )
        self.assertTrue(self.queue.remove_item(item_id))
        self.assertFalse(
            os.path.exists(os.path.join(self.test_queue_dir, f"{item_id}.json"))
        )

    def test_get_queue_status(self):
        self.queue.add_item(
            "audio_file",
            {
                "file_path": TEST_AUDIO_FILE_1,
                "author": TEST_AUTHOR,
                "library": TEST_LIBRARY,
            },
        )
        item_id = self.queue.add_item(
            "youtube_video",
            {"url": TEST_YOUTUBE_URL, "author": TEST_AUTHOR, "library": TEST_LIBRARY},
        )
        self.queue.add_item(
            "audio_file",
            {
                "file_path": TEST_AUDIO_FILE_2,
                "author": TEST_AUTHOR,
                "library": TEST_LIBRARY,
            },
        )

        self.queue.update_item_status(item_id, "completed")

        status = self.queue.get_queue_status()
        self.assertEqual(status["pending"], 2)
        self.assertEqual(status["completed"], 1)
        self.assertEqual(status["error"], 0)
        self.assertEqual(status["total"], 3)


if __name__ == "__main__":
    unittest.main()
