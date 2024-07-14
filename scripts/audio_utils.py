import os
import hashlib
from mutagen.mp3 import MP3
from mutagen.id3 import ID3NoHeaderError

def get_file_hash(file_path):
    """Calculate MD5 hash of file content."""
    hasher = hashlib.md5()
    with open(file_path, 'rb') as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hasher.update(chunk)
    return hasher.hexdigest()

def get_audio_metadata(file_path):
    """Extract the title and author from the MP3 file."""
    try:
        audio = MP3(file_path)
        if audio.tags:
            title = audio.tags.get('TIT2', [os.path.splitext(os.path.basename(file_path))[0]])[0]
            author = audio.tags.get('TPE1', ['Swami Kriyananda'])[0]
        else:
            # If there are no tags, use the filename as the title
            title = os.path.splitext(os.path.basename(file_path))[0]
            author = 'Swami Kriyananda'  # Default author
        return title, author
    except ID3NoHeaderError:
        # Handle files with no ID3 header
        print(f"Warning: No ID3 header found for {file_path}")
        return os.path.splitext(os.path.basename(file_path))[0], 'Swami Kriyananda'
    except Exception as e:
        print(f"Error reading MP3 metadata for {file_path}: {e}")
        return os.path.splitext(os.path.basename(file_path))[0], 'Swami Kriyananda'
    