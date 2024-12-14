import os
import sys
import yt_dlp
import subprocess
from tqdm import tqdm
from pinecone import Pinecone
from openai import OpenAI
from pathlib import Path
import argparse
import json
import random
import time
import nltk

# Add the project root to Python path for imports
project_root = str(Path(__file__).parent.parent.parent)
sys.path.append(project_root)

from python.util.env_utils import load_env
from python.data_ingestion.scripts.youtube_utils import extract_youtube_id

def parse_args():
    parser = argparse.ArgumentParser(description='Generate video supercuts from YouTube content')
    parser.add_argument('query', help='Search query for finding relevant video segments')
    parser.add_argument('--site', default='ananda', help='Site ID for environment variables')
    parser.add_argument('--num-clips', type=int, default=10, help='Number of clips to include')
    parser.add_argument('--output', default='supercut.mp4', help='Output file path')
    parser.add_argument('--clip-duration', type=float, default=None, 
                       help='Target duration for each clip in seconds. If not specified, uses full segment.')
    parser.add_argument('--padding', type=float, default=0.5,
                       help='Padding in seconds to add to start/end of each clip')
    return parser.parse_args()

# Initialize OpenAI and Pinecone clients
args = parse_args()
load_env(args.site)  # Will look for .env.ananda (or other site) file

# Verify required environment variables
required_vars = ['OPENAI_API_KEY', 'PINECONE_API_KEY', 'PINECONE_INDEX_NAME']
missing_vars = [var for var in required_vars if not os.getenv(var)]
if missing_vars:
    raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")

client = OpenAI()
pc = Pinecone(api_key=os.getenv('PINECONE_API_KEY'))
index_name = os.getenv('PINECONE_INDEX_NAME')
print(f"Connecting to Pinecone index: {index_name}")
index = pc.Index(index_name)

class SupercutGenerator:
    def __init__(self):
        self.cache_dir = Path("cache")
        self.temp_dir = Path("temp")
        self.cache_dir.mkdir(exist_ok=True)
        self.temp_dir.mkdir(exist_ok=True)
        
    def embed_query(self, query):
        """Generate embedding for search query"""
        response = client.embeddings.create(
            input=query,
            model="text-embedding-ada-002"
        )
        return response.data[0].embedding
    
    def find_sentence_boundaries(self, text, start_time, end_time, metadata, padding=0.5, target_duration=None):
        """Find the nearest complete sentence boundaries within target duration"""
        try:
            nltk.data.find('tokenizers/punkt')
        except LookupError:
            nltk.download('punkt', quiet=True)
        
        # Get the text and word timestamps from metadata
        words = metadata.get('words', [])
        if not words:
            return start_time, end_time
        
        sentences = nltk.sent_tokenize(text)
        if not sentences:
            return start_time, end_time
        
        # If we have a target duration, find the best sentence boundaries within that window
        if target_duration:
            mid_point = (start_time + end_time) / 2
            target_start = mid_point - (target_duration / 2)
            target_end = mid_point + (target_duration / 2)
            
            # Find closest sentence boundary before target_start
            for word in words:
                if word['start'] <= target_start:
                    new_start = word['start']
                else:
                    break
                    
            # Find closest sentence boundary after target_end
            for word in reversed(words):
                if word['end'] >= target_end:
                    new_end = word['end']
                else:
                    break
        else:
            # Original logic for finding complete sentences at start/end
            first_sentence = sentences[0]
            first_sentence_words = first_sentence.split()
            for word in words:
                if any(w.lower() in word['word'].lower() for w in first_sentence_words[-2:]):
                    new_start = word['start']
                    break
            else:
                new_start = start_time
                
            last_sentence = sentences[-1]
            last_sentence_words = last_sentence.split()
            for word in reversed(words):
                if any(w.lower() in word['word'].lower() for w in last_sentence_words[:2]):
                    new_end = word['end']
                    break
            else:
                new_end = end_time
        
        # Add padding to boundaries
        new_start = max(0, new_start - padding)  # Don't go below 0
        new_end = new_end + padding
        
        return new_start, new_end
    
    def find_relevant_segments(self, query, num_segments=10, target_duration=None, padding=0.5):
        """Find most relevant video segments and trim to sentence boundaries"""
        embedding = self.embed_query(query)
        results = index.query(
            vector=embedding,
            top_k=num_segments * 2,  # Get extra results in case some fail
            filter={"type": "youtube"},
            include_metadata=True
        )
        
        segments = []
        for match in results['matches'][:num_segments]:
            metadata = match['metadata']
            start_time = float(metadata['start_time'])
            end_time = float(metadata['end_time'])
            
            # Find proper sentence boundaries using word timestamps
            new_start, new_end = self.find_sentence_boundaries(
                metadata.get('text', ''),
                start_time,
                end_time,
                metadata,
                padding,
                target_duration
            )
            
            metadata['start_time'] = new_start
            metadata['end_time'] = new_end
            
            segments.append({
                'id': match['id'],
                'score': match['score'],
                'metadata': metadata,
                'text': metadata.get('text', '')
            })
        
        return segments
    
    def download_video(self, url):
        """Download YouTube video if not in cache"""
        youtube_id = extract_youtube_id(url)
        if not youtube_id:
            print("Invalid YouTube URL. Could not extract YouTube ID.")
            return None
        
        cache_path = self.cache_dir / f"{youtube_id}.mp4"
        
        if not cache_path.exists():
            print(f"Downloading video: {youtube_id}")
            
            ydl_opts = {
                "format": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",  # From youtube_utils
                "outtmpl": str(cache_path),
                "noplaylist": True,
                "extract_flat": False,
            }
            
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                        info = ydl.extract_info(url, download=True)
                        
                        if not cache_path.exists():
                            raise FileNotFoundError(f"Could not find the downloaded file: {cache_path}")
                        
                        # Verify file size
                        file_size = cache_path.stat().st_size
                        if file_size == 0:
                            cache_path.unlink()
                            raise ValueError(f"Downloaded file is empty: {youtube_id}")
                        
                        return cache_path
                        
                except yt_dlp.DownloadError as e:
                    error_msg = str(e)
                    if "Private video" in error_msg:
                        print(f"Skipping private video: {youtube_id}")
                        return None
                    elif "HTTP Error 403: Forbidden" in error_msg:
                        if attempt < max_retries - 1:
                            sleep_time = 30 * (2**attempt)
                            jitter = random.uniform(0, 15)
                            total_sleep_time = sleep_time + jitter
                            print(f"403 Forbidden error. Retrying in {total_sleep_time:.2f} seconds...")
                            time.sleep(total_sleep_time)
                        else:
                            print("Max retries reached. Unable to download due to 403 Forbidden error.")
                            return None
                    else:
                        print(f"YouTube download error: {error_msg}")
                        return None
                except Exception as e:
                    print(f"An error occurred while downloading: {e}")
                    if cache_path.exists():
                        cache_path.unlink()
                    return None
                
        return cache_path
    
    def extract_clip(self, video_path, start_time, end_time, output_path, target_duration=None):
        """Extract clip from video with optional duration target"""
        if target_duration and (end_time - start_time) > target_duration:
            # Center the clip around the middle
            mid_point = (start_time + end_time) / 2
            start_time = mid_point - (target_duration / 2)
            end_time = mid_point + (target_duration / 2)
        
        # First verify the source video has audio
        probe_cmd = [
            'ffprobe', '-v', 'error',
            '-select_streams', 'a',
            '-show_entries', 'stream=codec_type',
            '-of', 'default=nw=1:nk=1',
            str(video_path)
        ]
        
        has_audio = subprocess.run(probe_cmd, capture_output=True, text=True).stdout.strip() == 'audio'
        if not has_audio:
            raise ValueError(f"Video has no audio track: {video_path}")
        
        cmd = [
            'ffmpeg', '-i', str(video_path),
            '-ss', str(start_time),
            '-t', str(end_time - start_time),
            '-c:v', 'h264',     # Use h264 codec
            '-c:a', 'aac',      # Use AAC audio
            '-b:a', '192k',     # Set audio bitrate
            '-ac', '2',         # Set 2 audio channels
            '-ar', '44100',     # Set audio sample rate
            '-movflags', '+faststart',  # Enable streaming
            '-pix_fmt', 'yuv420p',  # Standard pixel format
            str(output_path),
            '-y',
            '-loglevel', 'error'
        ]
        subprocess.run(cmd, check=True)
        
    def create_compilation(self, segment_paths, output_path):
        """Concatenate segments with crossfade transitions"""
        filter_complex = []
        inputs = []
        
        # Add input for each segment
        for i, path in enumerate(segment_paths):
            inputs.extend(['-i', str(path)])
            # Scale and set SAR to 1:1
            filter_complex.append(f'[{i}:v]scale=640:480:force_original_aspect_ratio=decrease,setsar=1:1,pad=640:480:(ow-iw)/2:(oh-ih)/2[v{i}];')
            filter_complex.append(f'[{i}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[a{i}];')
        
        # Add the concat part
        for i in range(len(segment_paths)):
            filter_complex.append(f'[v{i}][a{i}]')
        
        filter_str = ''.join(filter_complex) + f'concat=n={len(segment_paths)}:v=1:a=1[outv][outa]'
        
        cmd = [
            'ffmpeg',
            *inputs,
            '-filter_complex', filter_str,
            '-map', '[outv]',
            '-map', '[outa]',
            '-c:v', 'h264',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-ac', '2',
            '-ar', '44100',
            '-movflags', '+faststart',
            '-pix_fmt', 'yuv420p',
            str(output_path),
            '-y',
            '-loglevel', 'error'
        ]
        
        print("\nFFmpeg command:")
        print(' '.join(cmd))
        
        subprocess.run(cmd, check=True)
        
    def create_supercut(self, query, output_path, num_clips=10, clip_duration=None, padding=0.5):
        """End-to-end process for creating supercut"""
        print(f"\nFinding relevant segments for: {query}")
        segments = self.find_relevant_segments(query, num_clips)
        
        if not segments:
            print("No relevant segments found!")
            return
        
        print("\nFound segments:")
        for i, seg in enumerate(segments):
            duration = float(seg['metadata']['end_time']) - float(seg['metadata']['start_time'])
            print(f"{i+1}. {seg['metadata'].get('title', 'Untitled')}")
            print(f"   Duration: {duration:.1f}s")
            print(f"   Score: {seg['score']:.3f}\n")
        
        # Allow manual filtering
        keep = input("\nEnter numbers of segments to keep (comma-separated) or press Enter for all: ")
        if keep.strip():
            keep_indices = [int(i)-1 for i in keep.split(',')]
            segments = [segments[i] for i in keep_indices]
        
        # Process segments
        segment_paths = []
        print("\nProcessing segments...")
        for seg in tqdm(segments):
            try:
                video_path = self.download_video(seg['metadata']['url'])
                if not video_path:
                    continue
                
                safe_id = ''.join(c if c.isalnum() else '_' for c in seg['id'])
                clip_path = self.temp_dir / f"{safe_id}.mp4"
                
                self.extract_clip(
                    video_path,
                    float(seg['metadata']['start_time']),
                    float(seg['metadata']['end_time']),
                    clip_path,
                    clip_duration
                )
                segment_paths.append(clip_path)
                
            except Exception as e:
                print(f"\nError processing segment {seg['id']}: {str(e)}")
                continue
        
        if not segment_paths:
            print("No valid segments to compile!")
            return
        
        print("\nCompiling final video...")
        try:
            self.create_compilation(segment_paths, output_path)
        except Exception as e:
            print(f"Error during compilation: {str(e)}")
            return
        
        # Clean up temp files
        for path in segment_paths:
            try:
                path.unlink()
            except Exception:
                pass
            
        print(f"\nDone! Output saved to: {output_path}")

def main():
    args = parse_args()
    generator = SupercutGenerator()
    generator.create_supercut(
        args.query, 
        args.output, 
        args.num_clips,
        args.clip_duration,
        args.padding
    )

if __name__ == "__main__":
    main() 