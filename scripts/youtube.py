import os
import json
from yt_dlp import YoutubeDL
from moviepy.editor import AudioFileClip
from mutagen.mp3 import MP3
from mutagen.id3 import ID3, TIT2, TPE1, TALB, COMM
import re
import uuid

def create_safe_filename(title: str) -> str:
    """
    Create a safe filename from the given title.
    Replaces spaces and special characters with underscores.
    """
    safe_title = re.sub(r'[^\w\-_\. ]', '_', title)
    safe_title = safe_title.replace(' ', '_')
    return safe_title

def get_video_metadata(yt: YoutubeDL):
    """Returns the metadata of a YouTube video as a dictionary."""
    metadata = {
        "title": yt.title,
        "author": yt.uploader,
        "length": yt.length,
        "views": yt.views,
        "description": yt.description
    }
    return metadata

def add_metadata_to_mp3(mp3_path: str, metadata: dict, url: str):
    """Adds metadata to the MP3 file."""
    try:
        print(f"Attempting to add metadata to: {mp3_path}")
        print(f"File exists: {os.path.exists(mp3_path)}")
        
        # Try to load existing ID3 tags
        audio = MP3(mp3_path, ID3=ID3)
        
        # If there are no ID3 tags, add them
        if audio.tags is None:
            audio.add_tags()

        # Add the metadata
        audio.tags.add(TIT2(encoding=3, text=metadata['title']))
        audio.tags.add(TPE1(encoding=3, text=metadata['author']))
        audio.tags.add(TALB(encoding=3, text="YouTube"))
        audio.tags.add(COMM(encoding=3, lang='eng', desc='desc', text=metadata['description']))
        audio.tags.add(COMM(encoding=3, lang='eng', desc='url', text=url))

        # Save the changes
        audio.save()
        print("Metadata added successfully.")
    except Exception as e:
        print(f"An error occurred while adding metadata: {e}")

def download_and_extract_audio(url: str, output_path: str = '.'):
    # Generate a random filename
    random_filename = str(uuid.uuid4())
    
    ydl_opts = {
        'format': 'bestaudio/best',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'outtmpl': os.path.join(output_path, f'{random_filename}.%(ext)s'),
    }

    try:
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            
            audio_path = os.path.join(output_path, f"{random_filename}.mp3")

            if not os.path.exists(audio_path):
                raise FileNotFoundError(f"Could not find the downloaded MP3 file: {audio_path}")
        
        # Get and add metadata to MP3
        metadata = {
            "title": info['title'],
            "author": info['uploader'],
            "description": info.get('description', '')
        }
        add_metadata_to_mp3(audio_path, metadata, url)

        print(f"Downloaded and extracted audio successfully: {info['title']}")
        print(f"File saved as: {audio_path}")
    except Exception as e:
        print(f"An error occurred: {e}")
        print("This might be due to an invalid URL or the video being unavailable.")

def get_channel_videos(channel_url: str, output_path: str = '.'):
    ydl_opts = {
        'extract_flat': True,
        'force_generic_extractor': True,
        'ignoreerrors': True,
    }

    try:
        with YoutubeDL(ydl_opts) as ydl:
            channel_info = ydl.extract_info(channel_url, download=False)
            
            if 'entries' not in channel_info:
                raise ValueError("Unable to find videos in the channel")

            print(f"Found channel: {channel_info.get('uploader', 'Unknown')}")
            print(f"Total videos: {len(channel_info['entries'])}")

            videos = []
            for entry in channel_info['entries']:
                videos.append({
                    'url': f"https://www.youtube.com/watch?v={entry['id']}",
                    'processed': False
                })

            channel_name = create_safe_filename(channel_info.get('uploader', 'Unknown'))
            json_filename = f"{channel_name}_videos.json"
            json_path = os.path.join(output_path, json_filename)

            with open(json_path, 'w') as f:
                json.dump(videos, f, indent=2)

            print(f"Video list saved to: {json_path}")

    except Exception as e:
        print(f"An error occurred: {e}")

def print_mp3_metadata(file_path: str):
    """Prints the metadata of an MP3 file."""
    try:
        audio = MP3(file_path, ID3=ID3)
        
        if audio.tags is None:
            print("No metadata found in the file.")
            return

        print(f"Title: {audio.tags.get('TIT2', 'Unknown')}")
        print(f"Artist: {audio.tags.get('TPE1', 'Unknown')}")
        print(f"Album: {audio.tags.get('TALB', 'Unknown')}")
        
        description = audio.tags.get('COMM:desc:eng')
        print(f"Description: {description.text[0] if description else 'None'}")
        
        url = audio.tags.get('COMM:url:eng')
        print(f"URL: {url.text[0] if url else 'None'}")
    except Exception as e:
        print(f"An error occurred while reading metadata: {e}")

if __name__ == "__main__":
    choice = input("Do you want to download a single video, get channel video list, or print metadata of an existing file? (v/c/m): ").strip().lower()
    
    if choice == 'v':
        video_url = input("Enter the YouTube video URL: ")
        output_directory = input("Enter the directory to save the audio (default is current directory): ") or '.'
        download_and_extract_audio(video_url, output_directory)
        
    elif choice == 'c':
        channel_url = input("Enter the YouTube channel URL: ")
        output_directory = input("Enter the directory to save the JSON file (default is current directory): ") or '.'
        get_channel_videos(channel_url, output_directory)
        
    elif choice == 'm':
        file_path = input("Enter the path to the MP3 file: ")
        print_mp3_metadata(file_path)
        
    else:
        print("Invalid choice. Please enter 'v', 'c', or 'm'.")