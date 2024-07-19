import unittest
import os
import sys
import logging
from dotenv import load_dotenv
import random
from mutagen.mp3 import MP3
from mutagen.id3 import ID3
from scripts.IngestQueue import IngestQueue

# Add the parent directory (scripts/) to the Python path
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(parent_dir)

from youtube_utils import download_youtube_audio
from transcription_utils import transcribe_media
from pinecone_utils import store_in_pinecone, load_pinecone
from s3_utils import upload_to_s3

YOUTUBE_URLS = [
    "https://youtu.be/MvyIpKLbayc?si=Nk9M7EDQ5oYngQkT",
    "https://youtu.be/WLtl1okZlYU?si=iKj-o_RwMgiA_1dn",
    "https://youtu.be/-AtW7c9pkGw?si=i4w-W6bGfIk7rI-n",
    "https://youtu.be/xUgtw_MwEas?si=HcdYvKjK17rZ3aK2",
    "https://youtu.be/zQDgBuoml4c?si=y2wGnAm76YxiMNLr",
    "https://youtu.be/r8iwgBVERm4?si=dBo7_HJ89gDUGeQw",
    "https://youtu.be/2s77yXNPwb0?si=abjnjhhBj9qGE1IY",
    "https://youtu.be/Lj8RuVB3JhI?si=xI9I4P_i5DtqoNqk",
    "https://youtu.be/m8b3E-mC6Ps?si=B7Xk3PGO_a63LXAR",
]


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


class TestYouTubeProcessing(unittest.TestCase):
    def setUp(self):
        self.test_video_url = random.choice(YOUTUBE_URLS)
        self.author = "Swami Kriyananda"
        self.library = "Ananda Sangha"
        self.audio_path = None
        logger.debug(f"Set up test with video URL: {self.test_video_url}")
        self.queue = IngestQueue()

    def tearDown(self):
        if self.audio_path and os.path.exists(self.audio_path):
            os.remove(self.audio_path)
            logger.debug(f"Cleaned up audio file: {self.audio_path}")

    def test_youtube_download(self):
        logger.debug("Starting YouTube download test")
        result = download_youtube_audio(self.test_video_url)
        self.assertIsNotNone(result)
        self.assertTrue(os.path.exists(result["audio_path"]))
        self.audio_path = result["audio_path"]
        logger.debug(f"YouTube download test completed. Audio path: {self.audio_path}")

    def test_transcription(self):
        logger.debug("Starting transcription test")
        youtube_data = download_youtube_audio(self.test_video_url)
        self.assertIsNotNone(youtube_data, "Failed to download YouTube audio")
        self.audio_path = youtube_data["audio_path"]
        transcripts = transcribe_media(self.audio_path)
        self.assertIsNotNone(transcripts)
        self.assertTrue(len(transcripts) > 0)
        logger.debug(
            f"Transcription test completed. Number of transcripts: {len(transcripts)}"
        )

    def test_pinecone_storage(self):
        logger.debug("Starting Pinecone storage test")
        youtube_data = download_youtube_audio(self.test_video_url)
        self.assertIsNotNone(youtube_data, "Failed to download YouTube audio")
        self.audio_path = youtube_data["audio_path"]
        transcripts = transcribe_media(self.audio_path)

        self.assertTrue(transcripts, "No transcripts were generated")

        logger.debug(f"Number of transcripts: {len(transcripts)}")

        # Create a single chunk for the entire transcript
        chunk = {
            "text": transcripts[0]["text"],
            "start": (
                transcripts[0]["words"][0]["start"] if transcripts[0]["words"] else None
            ),
            "end": (
                transcripts[0]["words"][-1]["end"] if transcripts[0]["words"] else None
            ),
        }

        logger.debug(f"Created chunk: {chunk}")

        index = load_pinecone()

        # Create a mock embedding with some non-zero values
        embedding = [random.uniform(0, 1) for _ in range(1536)]
        logger.debug(f"Created mock embedding with {len(embedding)} dimensions")

        store_in_pinecone(
            index,
            [chunk],
            [embedding],
            self.audio_path,
            self.author,
            self.library,
            True,
        )
        logger.debug("Pinecone storage test completed")

        # Add assertions to check if data was stored correctly
        self.assertEqual(1, len([chunk]), "Should have a single chunk")
        self.assertEqual(1, len([embedding]), "Should have a single embedding")
        self.assertTrue("text" in chunk, "Chunk should contain 'text'")
        self.assertTrue("start" in chunk, "Chunk should contain 'start'")
        self.assertTrue("end" in chunk, "Chunk should contain 'end'")

    def test_s3_upload_skipped(self):
        logger.debug("Starting S3 upload skip test")
        youtube_data = download_youtube_audio(self.test_video_url)

        # Check if youtube_data is None or doesn't contain 'audio_path'
        if youtube_data is None or "audio_path" not in youtube_data:
            self.fail("Failed to download YouTube audio or retrieve audio path")

        self.audio_path = youtube_data["audio_path"]
        result = upload_to_s3(self.audio_path)
        self.assertIsNone(
            result
        )  # Should be None as upload is skipped for YouTube videos
        logger.debug("S3 upload skip test completed")

    def test_audio_metadata(self):
        logger.debug("Starting audio metadata test")
        youtube_data = download_youtube_audio(self.test_video_url)

        if youtube_data is None or "audio_path" not in youtube_data:
            self.fail("Failed to download YouTube audio or retrieve audio path")

        self.audio_path = youtube_data["audio_path"]
        self.assertTrue(
            os.path.exists(self.audio_path),
            f"Audio file does not exist: {self.audio_path}",
        )

        try:
            audio = MP3(self.audio_path, ID3=ID3)

            # Check if tags exist
            self.assertIsNotNone(audio.tags, "No ID3 tags found in the audio file")

            # Check if URL is in the comments
            url_comment = audio.tags.getall("COMM:url:eng")
            self.assertTrue(url_comment, "URL comment not found in audio metadata")
            self.assertEqual(
                url_comment[0].text[0],
                self.test_video_url,
                "Stored URL does not match the original YouTube URL",
            )

            logger.debug("Audio metadata test completed successfully")
        except Exception as e:
            self.fail(f"Error reading audio metadata: {str(e)}")


if __name__ == "__main__":
    logger.debug("Starting test suite")
    unittest.main()
