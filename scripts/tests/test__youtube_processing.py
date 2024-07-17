import unittest
import os
import sys
import logging
from dotenv import load_dotenv
import random

# Add the parent directory (scripts/) to the Python path
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(parent_dir)

from youtube_utils import download_youtube_audio
from transcription_utils import transcribe_media
from pinecone_utils import store_in_pinecone, load_pinecone
from s3_utils import upload_to_s3

def configure_logging(debug=False):
    # Configure the root logger
    logging.basicConfig(level=logging.DEBUG if debug else logging.INFO, 
                        format='%(asctime)s - %(levelname)s - %(message)s')
    
    # Configure specific loggers
    loggers_to_adjust = [
        "openai", "httpx", "httpcore", "boto3", "botocore", "urllib3", "s3transfer"
    ]
    for logger_name in loggers_to_adjust:
        logging.getLogger(logger_name).setLevel(logging.INFO if debug else logging.WARNING)
    
    return logging.getLogger(__name__)

# Configure logging (you can set debug=True here for more verbose output)
logger = configure_logging(debug=True)

# Load .env file from the directory above scripts/
dotenv_path = os.path.join(os.path.dirname(parent_dir), '.env')
load_dotenv(dotenv_path)
logger.debug(f"Loaded .env file from: {dotenv_path}")


class TestYouTubeProcessing(unittest.TestCase):
    def setUp(self):
        self.test_video_url = "https://youtu.be/FYuPfDhqJPQ?si=oIUjZhv4Wep8IIVS"
        self.author = "Swami Kriyananda"
        self.library = "Ananda Sangha"
        logger.debug(f"Set up test with video URL: {self.test_video_url}")

    def test_youtube_download(self):
        logger.debug("Starting YouTube download test")
        result = download_youtube_audio(self.test_video_url)
        self.assertIsNotNone(result)
        self.assertTrue(os.path.exists(result['audio_path']))
        logger.debug(f"YouTube download test completed. Audio path: {result['audio_path']}")

    def test_transcription(self):
        logger.debug("Starting transcription test")
        youtube_data = download_youtube_audio(self.test_video_url)
        transcripts = transcribe_media(youtube_data['audio_path'])
        self.assertIsNotNone(transcripts)
        self.assertTrue(len(transcripts) > 0)
        logger.debug(f"Transcription test completed. Number of transcripts: {len(transcripts)}")

    def test_pinecone_storage(self):
        logger.debug("Starting Pinecone storage test")
        youtube_data = download_youtube_audio(self.test_video_url)
        transcripts = transcribe_media(youtube_data['audio_path'])
        
        self.assertTrue(transcripts, "No transcripts were generated")
        
        logger.debug(f"Number of transcripts: {len(transcripts)}")
        
        # Create a single chunk for the entire transcript
        chunk = {
            'text': transcripts[0]['text'],
            'start': transcripts[0]['words'][0]['start'] if transcripts[0]['words'] else None,
            'end': transcripts[0]['words'][-1]['end'] if transcripts[0]['words'] else None
        }
        
        logger.debug(f"Created chunk: {chunk}")
        
        index = load_pinecone()
        
        # Create a mock embedding with some non-zero values
        embedding = [random.uniform(0, 1) for _ in range(1536)]
        logger.debug(f"Created mock embedding with {len(embedding)} dimensions")
        
        store_in_pinecone(index, [chunk], [embedding], youtube_data['audio_path'], self.author, self.library, True)
        logger.debug("Pinecone storage test completed")
        
        # Add assertions to check if data was stored correctly
        self.assertEqual(1, len([chunk]), "Should have a single chunk")
        self.assertEqual(1, len([embedding]), "Should have a single embedding")
        self.assertTrue('text' in chunk, "Chunk should contain 'text'")
        self.assertTrue('start' in chunk, "Chunk should contain 'start'")
        self.assertTrue('end' in chunk, "Chunk should contain 'end'")

    def test_s3_upload_skipped(self):
        logger.debug("Starting S3 upload skip test")
        youtube_data = download_youtube_audio(self.test_video_url)
        
        # Check if youtube_data is None or doesn't contain 'audio_path'
        if youtube_data is None or 'audio_path' not in youtube_data:
            self.fail("Failed to download YouTube audio or retrieve audio path")
        
        result = upload_to_s3(youtube_data['audio_path'])
        self.assertIsNone(result)  # Should be None as upload is skipped for YouTube videos
        logger.debug("S3 upload skip test completed")

if __name__ == '__main__':
    logger.debug("Starting test suite")
    unittest.main()