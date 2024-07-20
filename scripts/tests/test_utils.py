import logging
from pydub import AudioSegment
import tempfile

logger = logging.getLogger(__name__)

def trim_audio(audio_path, max_duration_seconds=300):
    audio = AudioSegment.from_mp3(audio_path)
    trimmed_audio = audio[:max_duration_seconds * 1000]  # pydub works in milliseconds
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3")
    trimmed_audio.export(temp_file.name, format="mp3")
    logger.debug(f"Created trimmed audio file: {temp_file.name}")
    return temp_file.name