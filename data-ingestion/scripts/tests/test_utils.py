import logging
from pydub import AudioSegment
import tempfile
from mutagen.mp3 import MP3
from mutagen.id3 import ID3, ID3NoHeaderError

logger = logging.getLogger(__name__)

def trim_audio(audio_path, max_duration_seconds=300):
    audio = AudioSegment.from_mp3(audio_path)
    trimmed_audio = audio[:max_duration_seconds * 1000]  # pydub works in milliseconds
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3")
    trimmed_audio.export(temp_file.name, format="mp3")
    
    # Copy metadata from the original audio file to the trimmed audio file
    try:
        original_audio = MP3(audio_path, ID3=ID3)
        trimmed_audio = MP3(temp_file.name, ID3=ID3)
        
        if original_audio.tags:
            trimmed_audio.tags = original_audio.tags
            trimmed_audio.save()
            logger.debug(f"Copied metadata to trimmed audio file: {temp_file.name}")
        else:
            logger.warning(f"No metadata found in the original audio file: {audio_path}")
    except ID3NoHeaderError:
        logger.warning(f"No ID3 header found in the original audio file: {audio_path}")
    except Exception as e:
        logger.error(f"Error copying metadata to trimmed audio file: {e}")

    logger.debug(f"Created trimmed audio file: {temp_file.name}")
    return temp_file.name