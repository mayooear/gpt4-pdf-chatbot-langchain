#!/usr/bin/env python

"""
Vector Database Statistics Generator

This script analyzes a Pinecone vector database to generate statistics about stored vectors,
specifically counting occurrences of metadata fields (author, library, type). It implements
retry logic for handling network issues and processes vectors in batches for efficiency.
"""

import os
import sys
import argparse
from collections import Counter
from pinecone import Pinecone
from tqdm import tqdm
from urllib3.exceptions import ProtocolError
import time
import random

# Add parent directory to Python path for importing utility modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from util.env_utils import load_env

def query_with_retries(index, vector_id, max_retries=3, initial_delay=1):
    """
    Query Pinecone index with exponential backoff retry logic.
    
    Args:
        index: Pinecone index instance
        vector_id: ID of the vector to query
        max_retries: Maximum number of retry attempts (default: 3)
        initial_delay: Base delay in seconds for retry backoff (default: 1)
    
    Returns:
        Query response or raises final ProtocolError after max retries
    """
    for attempt in range(max_retries):
        try:
            return index.query(
                id=vector_id,
                top_k=1,
                include_metadata=True
            )
        except ProtocolError:
            if attempt == max_retries - 1:
                raise
            # Calculate exponential backoff with jitter
            delay = initial_delay * (2 ** attempt) + random.uniform(0, 1)
            time.sleep(delay)

def get_pinecone_stats():
    """
    Retrieves and aggregates statistics from Pinecone vectors.
    
    Processes vectors in batches to optimize performance while collecting
    metadata counts for author, library, and type fields.
    
    Returns:
        dict: Counters for each metadata field (author, library, type)
    """
    pc = Pinecone(api_key=os.getenv('PINECONE_API_KEY'))
    index = pc.Index(os.getenv('PINECONE_INGEST_INDEX_NAME'))
    
    # Initialize counters for each metadata field
    stats = {
        'author': Counter(),
        'library': Counter(),
        'type': Counter()
    }
    
    # Get total vector count for progress tracking
    index_stats = index.describe_index_stats()
    total_vectors = index_stats.total_vector_count
    pbar = tqdm(total=total_vectors, desc="Processing vectors")
    
    # Process vectors in batches for better performance
    batch_size = 100
    id_batch = []
    
    # Main processing loop
    for vector_ids in index.list():
        id_batch.extend(vector_ids)
        
        if len(id_batch) >= batch_size:
            for vector_id in id_batch:
                response = query_with_retries(index, vector_id)
                if response and response.matches:
                    metadata = response.matches[0].metadata
                    if metadata:
                        # Update counters for each metadata field if present
                        for field in ['author', 'library', 'type']:
                            if field in metadata:
                                stats[field][metadata[field]] += 1
            
            pbar.update(len(id_batch))
            id_batch = []
    
    # Handle any remaining vectors in the final batch
    if id_batch:
        for vector_id in id_batch:
            response = query_with_retries(index, vector_id)
            if response and response.matches:
                metadata = response.matches[0].metadata
                if metadata:
                    for field in ['author', 'library', 'type']:
                        if field in metadata:
                            stats[field][metadata[field]] += 1
        pbar.update(len(id_batch))
    
    pbar.close()
    return stats

def print_stats(stats):
    """
    Prints formatted statistics for each metadata category.
    
    Args:
        stats: Dictionary containing Counters for each metadata field
    """
    for category, counter in stats.items():
        print(f"\n{category.upper()} STATS:")
        for item, count in counter.most_common():
            print(f"{item}: {count}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Get Pinecone vector statistics')
    parser.add_argument('--site', required=True, help='Site ID for environment variables')
    args = parser.parse_args()
    
    # Load environment variables for the specified site
    load_env(args.site)
    stats = get_pinecone_stats()
    print_stats(stats)
