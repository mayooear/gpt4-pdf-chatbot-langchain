import logging
from pydub import AudioSegment
import tempfile
from mutagen.mp3 import MP3
from mutagen.id3 import ID3, ID3NoHeaderError, COMM

logger = logging.getLogger(__name__)

def trim_audio(audio_path, max_duration_seconds=300):
    audio = AudioSegment.from_mp3(audio_path)
    trimmed_audio = audio[:max_duration_seconds * 1000]  # pydub works in milliseconds
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as temp_file:
        temp_file_path = temp_file.name
        
        # Export the trimmed audio to the temporary file
        trimmed_audio.export(temp_file_path, format="mp3")
    
    # Copy metadata from the original audio file to the trimmed audio file
    try:
        original_audio = MP3(audio_path, ID3=ID3)
        trimmed_audio = MP3(temp_file_path, ID3=ID3)
        
        if original_audio.tags:
            # Copy all tags from the original file to the trimmed file
            for key, value in original_audio.tags.items():
                trimmed_audio.tags[key] = value
            
            # Ensure the URL comment is in the correct format
            url_comments = [frame for frame in trimmed_audio.tags.getall("COMM") if frame.desc == 'url']
            if url_comments:
                url = url_comments[0].text[0] if isinstance(url_comments[0].text, list) else url_comments[0].text
                trimmed_audio.tags.add(COMM(encoding=3, lang='eng', desc='url', text=url))
            else:
                logger.warning("URL comment not found in original audio")
            
            trimmed_audio.save()
            
        else:
            logger.warning(f"No metadata found in the original audio file: {audio_path}")
    except ID3NoHeaderError:
        logger.warning(f"No ID3 header found in the original audio file: {audio_path}")
    except Exception as e:
        logger.error(f"Error copying metadata to trimmed audio file: {e}")

    return temp_file_path