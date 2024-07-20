import unittest
import os
import sys
import logging
from dotenv import load_dotenv
from openai import OpenAI
from pinecone.core.client.exceptions import PineconeException
from unittest.mock import patch
from IngestQueue import IngestQueue  

# Add the parent directory (scripts/) to the Python path
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(parent_dir)

from transcription_utils import transcribe_media, chunk_transcription
from pinecone_utils import store_in_pinecone, load_pinecone, create_embeddings
from s3_utils import upload_to_s3
from media_utils import get_media_metadata


def configure_logging(debug=False):
    # Configure the root logger
    logging.basicConfig(
        level=logging.DEBUG if debug else logging.INFO,
        format="%(asctime)s - %(levelname)s - %(message)s",
    )

    # Configure specific loggers
    loggers_to_adjust = [
        "openai",
        "httpx",
        "httpcore",
        "boto3",
        "botocore",
        "urllib3",
        "s3transfer",
    ]
    for logger_name in loggers_to_adjust:
        logging.getLogger(logger_name).setLevel(
            logging.INFO if debug else logging.WARNING
        )

    return logging.getLogger(__name__)


# Configure logging (you can set debug=True here for more verbose output)
logger = configure_logging(debug=True)

# Load .env file from the directory above scripts/
dotenv_path = os.path.join(os.path.dirname(parent_dir), ".env")
load_dotenv(dotenv_path)
logger.debug(f"Loaded .env file from: {dotenv_path}")


class TestAudioProcessing(unittest.TestCase):
    def setUp(self):
        self.test_audio_path = (
            "../media/media/unit-test-data/how-to-commune-with-god.mp3"
        )
        self.author = "Paramhansa Yogananda"
        self.library = "Ananda Sangha"
        self.client = OpenAI()
        self.temp_files = []
        self.queue = IngestQueue()
        logger.debug(f"Set up test with audio file: {self.test_audio_path}")

    def tearDown(self):
        for file_path in self.temp_files:
            if os.path.exists(file_path):
                os.remove(file_path)
                logger.debug(f"Cleaned up temporary file: {file_path}")
        self.temp_files.clear()

    def test_audio_metadata(self):
        logger.debug("Starting audio metadata test")
        title, author, duration, url = get_media_metadata(self.test_audio_path)
        self.assertIsNotNone(title)
        self.assertIsNotNone(author)
        self.assertGreater(duration, 0)
        self.assertIsNone(url)  # URL should be None for non-YouTube audio
        logger.debug(
            f"Audio metadata test completed. Title: {title}, Author: {author}, Duration: {duration}"
        )

    def test_transcription(self):
        logger.debug("Starting transcription test")
        transcripts = transcribe_media(self.test_audio_path)
        self.assertIsNotNone(transcripts)
        self.assertTrue(len(transcripts) > 0)
        logger.debug(
            f"Transcription test completed. Number of transcripts: {len(transcripts)}"
        )

    def test_chunk_transcription(self):
        logger.debug("Starting process transcription test")
        transcripts = transcribe_media(self.test_audio_path)
        chunks = chunk_transcription(transcripts[0])
        self.assertIsNotNone(chunks)
        self.assertTrue(len(chunks) > 0)
        logger.debug(
            f"Process transcription test completed. Number of chunks: {len(chunks)}"
        )

    def test_pinecone_storage_success(self):
        logger.debug("Starting Pinecone storage success test")
        transcripts = transcribe_media(self.test_audio_path)
        chunks = chunk_transcription(transcripts[0])

        self.assertTrue(chunks, "No chunks were generated")

        logger.debug(f"Number of chunks: {len(chunks)}")

        index = load_pinecone()

        # Create real embeddings using the existing library code
        embeddings = create_embeddings(chunks, self.client)

        logger.debug(
            f"Created {len(embeddings)} embeddings, each with {len(embeddings[0])} dimensions"
        )

        try:
            store_in_pinecone(
                index,
                chunks,
                embeddings,
                self.test_audio_path,
                self.author,
                self.library,
            )
            logger.debug("Pinecone storage success test completed")
        except PineconeException as e:
            self.fail(f"Pinecone storage failed unexpectedly: {str(e)}")

        # Add assertions to check if data was stored correctly
        self.assertGreater(len(chunks), 0, "Should have at least one chunk")
        self.assertTrue("text" in chunks[0], "Chunk should contain 'text'")
        self.assertTrue("start" in chunks[0], "Chunk should contain 'start'")
        self.assertTrue("end" in chunks[0], "Chunk should contain 'end'")

    def test_pinecone_storage_error(self):
        logger.debug("Starting Pinecone storage error test")
        transcripts = transcribe_media(self.test_audio_path)
        chunks = chunk_transcription(transcripts[0])

        self.assertTrue(chunks, "No chunks were generated")

        logger.debug(f"Number of chunks: {len(chunks)}")

        index = load_pinecone()

        # Create real embeddings using the existing library code
        embeddings = create_embeddings(chunks, self.client)

        logger.debug(
            f"Created {len(embeddings)} embeddings, each with {len(embeddings[0])} dimensions"
        )

        # Simulate an error by patching the index.upsert method
        with patch.object(
            index, "upsert", side_effect=Exception("Simulated Pinecone error")
        ):
            # Expect a PineconeException to be raised
            with self.assertRaises(PineconeException) as context:
                store_in_pinecone(
                    index,
                    chunks,
                    embeddings,
                    self.test_audio_path,
                    self.author,
                    self.library,
                )

        # Check if the error message contains the expected content
        self.assertIn("Failed to upsert vectors", str(context.exception))
        self.assertIn("Simulated Pinecone error", str(context.exception))

        logger.debug("Pinecone storage error test completed with expected error")

    def test_s3_upload(self):
        logger.debug("Starting S3 upload test")
        result = upload_to_s3(self.test_audio_path)
        self.assertIsNone(result)  # Should be None if upload is successful
        logger.debug("S3 upload test completed")


if __name__ == "__main__":
    logger.debug("Starting test suite")
    unittest.main()
