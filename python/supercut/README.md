# Supercut Generator

Creates video supercuts from YouTube content based on semantic search queries.

## Prerequisites

- Python 3.8+
- ffmpeg installed on system
- OpenAI API key
- Pinecone API key and index

## Installation

1. Install ffmpeg:

   ### Ubuntu/Debian

   `sudo apt-get install ffmpeg`

   ### macOS

   `brew install ffmpeg`

2. Install Python dependencies: `bash
pip install -r requirements.txt`

3. Set up environment variables in `.env`: `OPENAI_API_KEY=your_key_here
PINECONE_API_KEY=your_key_here
PINECONE_ENVIRONMENT=your_env_here
PINECONE_INDEX=your_index_here`

## Usage

Basic usage:

`python supercut.py "importance of daily meditation" --site ananda --num-clips 8 --output meditation_supercut.mp4`

Specify number of clips and output path:

`python supercut.py "importance of daily meditation" --site ananda --num-clips 8 --output meditation_supercut.mp4`

The script will use the environment variables from the specified site configuration.
The site parameter defaults to 'ananda' if not specified.
