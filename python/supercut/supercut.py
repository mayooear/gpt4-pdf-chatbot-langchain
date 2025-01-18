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
import gzip
import tempfile
import uuid

# Add the project root to Python path for imports
project_root = str(Path(__file__).parent.parent.parent)
sys.path.append(project_root)

from python.util.env_utils import load_env
from python.data_ingestion.scripts.youtube_utils import extract_youtube_id
from python.data_ingestion.scripts.media_utils import get_file_hash
from python.data_ingestion.scripts.transcription_utils import (
    TRANSCRIPTIONS_DIR, 
    get_saved_transcription
)


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
    def __init__(self, model="text-embedding-ada-002"):
        self.client = OpenAI()
        self.model = model
        self.cache_dir = Path("cache")
        self.temp_dir = Path("temp")
        self.cache_dir.mkdir(exist_ok=True)
        self.temp_dir.mkdir(exist_ok=True)
        
        # More conservative silence detection parameters
        self.silence_threshold_db = -35
        self.min_silence_duration = 0.75  # Longer = only detect clear pauses
                
        self.silence_cache_path = Path("cache/silence_cache.json.gz")
        self.silence_cache_path.parent.mkdir(exist_ok=True)
        self.silence_cache = self._load_silence_cache()
        
    def _load_silence_cache(self):
        """Load silence cache from disk"""
        if self.silence_cache_path.exists():
            with gzip.open(self.silence_cache_path, 'rt') as f:
                return json.load(f)
        return {}
        
    def _save_silence_cache(self):
        """Save silence cache to disk"""
        with gzip.open(self.silence_cache_path, 'wt') as f:
            json.dump(self.silence_cache, f)
            
    def get_embedding(self, text):
        """Get embedding for text using OpenAI's API"""
        response = self.client.embeddings.create(
            model=self.model,
            input=text
        )
        return response.data[0].embedding
    
    def embed_query(self, query):
        """Generate embedding for search query"""
        response = self.client.embeddings.create(
            input=query,
            model="text-embedding-ada-002"
        )
        return response.data[0].embedding
    
    def find_sentence_boundaries(self, text, start_time, end_time, metadata, video_path, padding=0.5, target_duration=None):
        """Find the nearest complete sentence boundaries using both silence detection and word timestamps"""
        print(f"\nDEBUG: Starting sentence boundary detection for {video_path}")
        
        youtube_id = extract_youtube_id(metadata['url'])
        transcription = get_saved_transcription(None, is_youtube_video=True, youtube_id=youtube_id)
        
        if transcription:
            # Handle both flat and chunked formats
            if 'chunks' in transcription:
                words = []
                for chunk in transcription['chunks']:
                    words.extend(chunk['words'])
            else:
                words = transcription.get('words', [])
        else:
            print("DEBUG: ***** No transcription found, falling back to silence detection only")
            words = []
        
        try:
            nltk.data.find('tokenizers/punkt')
        except LookupError:
            nltk.download('punkt', quiet=True)

        if not words:
            print("DEBUG: No word timestamps found, falling back to silence detection only")
            silences = self.find_silences(video_path)
            return start_time, end_time

        # Find silence periods in this segment of video
        print("DEBUG: About to analyze silences...")
        silences = self.find_silences(video_path)
        print(f"DEBUG: Found {len(silences)} silences")  # New debug print
        
        segment_silences = [s for s in silences if s['start'] >= start_time and s['end'] <= end_time]
        
        sentences = nltk.sent_tokenize(text)
        if not sentences:
            return start_time, end_time
        
        # If we have a target duration, find the best sentence boundaries within that window
        if target_duration:
            mid_point = (start_time + end_time) / 2
            target_start = mid_point - (target_duration / 2)
            target_end = mid_point + (target_duration / 2)
            
            # Find best silence near target_start
            start_silence = self.find_best_cut_point(segment_silences, target_start, window=2.0)  # Increased window
            if not start_silence:
                print("No good silence found for start - skipping clip")
                return None, None
            
            # Find best silence near target_end    
            end_silence = self.find_best_cut_point(segment_silences, target_end, window=2.0)  # Increased window
            if not end_silence:
                print("No good silence found for end - skipping clip")
                return None, None
            
            new_start = start_silence['end']  # Use end of silence period
            new_end = end_silence['start']  # Use start of silence period
            
            # Verify the clip isn't too short
            if new_end - new_start < target_duration * 0.65:  # Allow some flexibility
                print(f"Resulting clip too short ({new_end - new_start:.1f}s) - skipping")
                return None, None
        else:
            # For full segments, find silences near sentence boundaries
            first_sentence = sentences[0]
            first_sentence_words = first_sentence.split()
            sentence_start = None
            for word in words:
                if any(w.lower() in word['word'].lower() for w in first_sentence_words[-2:]):
                    sentence_start = word['start']
                    break
            
            if sentence_start:
                start_silence = self.find_best_cut_point(segment_silences, sentence_start, window=1.0)
                new_start = start_silence['end'] if start_silence else sentence_start
            else:
                new_start = start_time
                
            last_sentence = sentences[-1]
            last_sentence_words = last_sentence.split()
            sentence_end = None
            for word in reversed(words):
                if any(w.lower() in word['word'].lower() for w in last_sentence_words[:2]):
                    sentence_end = word['end']
                    break
                
            if sentence_end:
                end_silence = self.find_best_cut_point(segment_silences, sentence_end, window=1.0)
                new_end = end_silence['start'] if end_silence else sentence_end
            else:
                new_end = end_time
        
        # Add padding to boundaries
        new_start = max(0, new_start - padding)  # Don't go below 0
        new_end = new_end + padding
        
        print(f"\nSegment analysis:")
        print(f"Original: {start_time:.1f}s - {end_time:.1f}s ({end_time-start_time:.1f}s)")
        print(f"New: {new_start:.1f}s - {new_end:.1f}s ({new_end-new_start:.1f}s)")
        if target_duration:
            print(f"Target duration: {target_duration:.1f}s")
        print(f"Silences found: {len(segment_silences)}")
        
        return new_start, new_end
    
    def find_relevant_segments(self, query, num_clips, clip_duration=None, padding=0.5):
        """Find relevant segments from the video corpus"""
        print("\nDEBUG: Starting find_relevant_segments")
        
        results = index.query(
            vector=self.get_embedding(query),
            top_k=int(num_clips) * 3,
            filter={"type": "youtube"},
            include_metadata=True
        )
        
        segments = []
        for match in results.matches:
            try:
                metadata = match.metadata
                text = metadata.get('text', '')
                start_time = float(metadata['start_time'])
                end_time = float(metadata['end_time'])
                
                video_path = self.download_video(metadata['url'])
                if not video_path:
                    print("DEBUG: Failed to download video")  # Debug print 3
                    continue
                    
                # Add video_path to metadata
                metadata['video_path'] = str(video_path)
                
                # Find sentence boundaries (keeping this part intact)
                new_start, new_end = self.find_sentence_boundaries(
                    text, start_time, end_time, metadata, video_path, 
                    padding=padding, target_duration=clip_duration
                )
                
                if new_start is None:  # Skip this segment
                    print(f"Skipping segment due to poor cut points")
                    continue
                    
                segment = {
                    'id': match.id,
                    'score': match.score,
                    'metadata': metadata,  # Now includes video_path
                    'text': text,
                    'start_time': new_start,
                    'end_time': new_end
                }
                
                segments.append(segment)
                
            except Exception as e:
                print(f"Error processing segment: {e}")
                continue
        
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
        
    def create_supercut(self, query, num_clips, output_path, clip_duration=30, padding=0.5):
        """Create a supercut video from relevant segments"""
        
        segments = self.find_relevant_segments(query, num_clips, clip_duration, padding)
        if not segments:
            print("No relevant segments found")
            return

        print("\nProcessing segments...")
        processed_segments = []
        segment_paths = []
        clips_needed = num_clips
        batch_size = 5  # Try 5 segments at a time
        
        # Sort segments by score
        sorted_segments = sorted(segments, key=lambda x: x['score'], reverse=True)
        
        # Process segments in batches until we have enough clips
        for i in range(0, len(sorted_segments), batch_size):
            batch = sorted_segments[i:i+batch_size]
            
            for segment in tqdm(batch):
                try:
                    processed_clip = self.process_segment(segment, clip_duration, padding)
                    if processed_clip:
                        processed_segments.append(processed_clip)
                        segment_paths.append(processed_clip['path'])
                        clips_needed -= 1
                        if clips_needed <= 0:
                            break
                except Exception as e:
                    print(f"Error processing segment: {e}")
                    continue
                    
            if clips_needed <= 0:
                break
                
        if not processed_segments:
            print("No segments could be processed successfully")
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
    
    def find_silences(self, video_path, silence_threshold=-30, min_silence_duration=0.3):
        """Find silences in video with persistent caching"""
        # Create cache key from parameters and file hash
        file_hash = get_file_hash(video_path)
        cache_key = f"{file_hash}_{silence_threshold}_{min_silence_duration}"
        
        # Return cached result if available
        if cache_key in self.silence_cache:
            return self.silence_cache[cache_key]
            
        # Detect silences using ffmpeg
        cmd = [
            'ffmpeg', '-i', str(video_path),
            '-af', f'silencedetect=noise={silence_threshold}dB:d={min_silence_duration}',
            '-f', 'null', '-'
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        # Parse ffmpeg output for silence periods
        silences = []
        for line in result.stderr.split('\n'):
            if 'silence_start' in line:
                start = float(line.split('silence_start: ')[1])
                silences.append({'start': start})
            elif 'silence_end' in line and silences:
                # Extract just the end time before the pipe
                end = float(line.split('silence_end: ')[1].split('|')[0].strip())
                silences[-1]['end'] = end
                silences[-1]['duration'] = end - silences[-1]['start']
                print(f"Found silence: {silences[-1]['start']:.2f}s - {end:.2f}s (duration: {silences[-1]['duration']:.2f}s)")
        
        print(f"Found {len(silences)} silence periods")
        if silences:
            print("Sample silences:")
            for i, silence in enumerate(silences[:3]):  # Show first 3 silences
                print(f"  {i+1}. {silence['start']:.1f}s - {silence['end']:.1f}s (duration: {silence['duration']:.1f}s)")
                
        # Cache the results
        self.silence_cache[cache_key] = silences
        self._save_silence_cache()
        return silences
    
    def find_best_cut_point(self, silences, target_time, window=2.0, min_silence_duration=0.5):
        """Find best silence period near target time"""
        if not silences:
            return None
            
        # Only consider silences long enough for a clean cut
        valid_silences = [s for s in silences if s['duration'] >= min_silence_duration]
        if not valid_silences:
            return None
            
        # Find silences within our window
        nearby_silences = [s for s in valid_silences 
                         if abs(s['start'] - target_time) < window or 
                            abs(s['end'] - target_time) < window]
        
        if not nearby_silences:
            return None
            
        # Prefer longer silences that are closer to target
        scored_silences = [
            (s, s['duration'] * (1 - abs(target_time - (s['start'] + s['end'])/2) / window))
            for s in nearby_silences
        ]
        
        return max(scored_silences, key=lambda x: x[1])[0]
    
    def process_segment(self, segment, clip_duration, padding):
        """Process a single segment into a clip"""
        try:
            print("\nDEBUG: Segment structure:")
            print(f"DEBUG: Keys in segment: {segment.keys()}")
            if 'metadata' in segment:
                print(f"DEBUG: Keys in metadata: {segment['metadata'].keys()}")
            
            video_path = segment['metadata']['video_path']  # Match the structure from find_relevant_segments
            
            # Extract the clip
            start_time = float(segment['metadata']['start_time'])
            end_time = float(segment['metadata']['end_time'])
            
            # Create temp output path for this clip
            temp_output = Path(tempfile.mkdtemp()) / f"clip_{uuid.uuid4()}.mp4"
            
            print(f"\nDEBUG: Processing clip:")
            print(f"DEBUG: Video path: {video_path}")
            print(f"DEBUG: Time range: {start_time:.2f}s - {end_time:.2f}s")
            
            # Cut the video
            self.cut_video(
                video_path, 
                temp_output, 
                start_time, 
                end_time, 
                target_duration=clip_duration
            )
            
            return {
                'path': temp_output,
                'start': start_time,
                'end': end_time,
                'score': segment['score']
            }
            
        except Exception as e:
            print(f"Error processing clip: {str(e)}")
            print(f"DEBUG: Full segment data: {segment}")
            return None

    def cut_video(self, input_path, output_path, start_time, end_time, target_duration=None):
        """Cut a segment from video"""
        try:
            # If target duration specified, adjust end time
            if target_duration and (end_time - start_time) > target_duration:
                end_time = start_time + target_duration
                
            cmd = [
                'ffmpeg', '-y',  # Overwrite output file if exists
                '-i', str(input_path),
                '-ss', str(start_time),
                '-to', str(end_time),
                '-c', 'copy',  # Copy codecs for faster processing
                str(output_path)
            ]
            
            subprocess.run(cmd, capture_output=True, text=True)
            return True
            
        except Exception as e:
            print(f"Error cutting video: {e}")
            return False

def main():
    args = parse_args()
    generator = SupercutGenerator()
    generator.create_supercut(
        query=args.query,
        num_clips=args.num_clips,
        output_path=args.output,
        clip_duration=args.clip_duration,
        padding=args.padding
    )

if __name__ == "__main__":
    main() 