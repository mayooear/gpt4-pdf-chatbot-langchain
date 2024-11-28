#! /usr/bin/env python3

"""
Script to standardize author names in Pinecone metadata.

This script finds and replaces various alternative forms of an author's name with a canonical version.
It's particularly useful for cleaning up inconsistencies in author names across a document collection.

Required Environment Variables (in .env.[site]):
    PINECONE_API_KEY: Your Pinecone API key
    PINECONE_ENVIRONMENT: Your Pinecone environment
    PINECONE_INDEX_NAME: Default index name (can be overridden with --index-name)

Config File Format (JSON):
{
    "alternative_names": [
        "Name Variant 1",
        "Name Variant 2 (with notes)",
        "Misspelled Name"
    ],
    "canonical_name": "Official Author Name"
}

Example config:
{
    "alternative_names": [
        "Nayaswami Kriyananda",
        "Swami Kriyananda (J. Donald Walters)",
        "Swami Kriyanananda"
    ],
    "canonical_name": "Swami Kriyananda"
}

Usage:
    python clean_pinecone_authors.py --site ananda --config author_config.json --dry-run
    python clean_pinecone_authors.py --site ananda --config author_config.json
"""

import argparse
from typing import List, Dict
import json
from tqdm import tqdm
import os
from dotenv import load_dotenv
from pinecone import Pinecone

def load_env(site_id: str) -> None:
    """
    Load environment variables from a site-specific .env file.
    Searches up to 3 directories up from current directory.
    
    Args:
        site_id: Identifier for the site (e.g., 'ananda', 'crystal')
    
    Raises:
        FileNotFoundError: If no .env.[site_id] file is found
    """
    current_dir = os.getcwd()
    
    for _ in range(4):
        env_path = os.path.join(current_dir, f'.env.{site_id}')
        if os.path.exists(env_path):
            load_dotenv(env_path)
            print(f"Loaded environment from: {env_path}")
            return
        current_dir = os.path.dirname(current_dir)
    
    raise FileNotFoundError(f"Environment file .env.{site_id} not found in the current directory or up to three levels up")

def get_pinecone_client() -> Pinecone:
    """Initialize and return Pinecone client using environment variables."""
    return Pinecone(api_key=os.getenv('PINECONE_API_KEY'))

def get_index(pc: Pinecone, index_name: str = None):
    """
    Get Pinecone index instance.
    
    Args:
        pc: Pinecone client instance
        index_name: Optional override for index name from environment
    
    Returns:
        pinecone.Index: The Pinecone index instance
    """
    if index_name is None:
        index_name = os.getenv('PINECONE_INDEX_NAME')
    return pc.Index(index_name)

def find_and_replace_authors(
    index,
    alternative_names: List[str],
    canonical_name: str,
    dry_run: bool = True,
    batch_size: int = 100
) -> Dict[str, int]:
    """
    Find and replace author names in Pinecone metadata.
    
    Args:
        index: Pinecone index instance
        alternative_names: List of alternative author names to search for
        canonical_name: The standardized name to replace alternatives with
        dry_run: If True, only count matches without making changes
        batch_size: Number of records to update in each batch
    
    Returns:
        Dict mapping each alternative name to the number of matches found
    
    Note:
        Uses a dummy vector for querying since we only care about metadata.
        Updates are performed in batches to avoid overwhelming the API.
    """
    stats = {name: 0 for name in alternative_names}
    
    for alt_name in alternative_names:
        # Query using exact match on author field
        query_response = index.query(
            vector=[0] * 1536,  # dummy vector since we only care about metadata
            top_k=10000,  # maximum number of matches to return
            filter={"author": {"$eq": alt_name}},
            include_metadata=True,
            include_values=True  # Make sure we get the vector values
        )
        
        matches = query_response.matches
        stats[alt_name] = len(matches)
        
        if dry_run and matches:
            # In dry run, show sample of changes that would be made
            print(f"\nSample changes for '{alt_name}':")
            for match in matches[:3]:  # Show first 3 examples
                print(f"  ID: {match.id}")
                print(f"  Current metadata: {match.metadata}")
                new_metadata = match.metadata.copy()
                new_metadata['author'] = canonical_name
                print(f"  Would change to: {new_metadata}\n")
            if len(matches) > 3:
                print(f"  ... and {len(matches) - 3} more similar changes")
        
        elif not dry_run and matches:
            # Process updates in batches with progress bar
            for i in tqdm(range(0, len(matches), batch_size), desc=f"Updating {alt_name}"):
                batch = matches[i:i + batch_size]
                update_ops = []
                
                for match in batch:
                    # Create update operation, preserving all metadata except author
                    metadata = match.metadata.copy()
                    metadata['author'] = canonical_name
                    # Use the vector values from the query response
                    update_ops.append((match.id, match.values, metadata))
                
                index.upsert(vectors=update_ops)
    
    return stats

def main():
    """
    Main entry point. Handles argument parsing and orchestrates the cleanup process.
    
    Command-line Arguments:
        --site: Site ID for loading environment variables
        --config: Path to JSON config file with name mappings
        --dry-run: Flag to run without making changes
        --index-name: Optional override for Pinecone index name
    """
    parser = argparse.ArgumentParser(description='Clean up author names in Pinecone metadata')
    parser.add_argument('--site', required=True, help='Site ID for environment variables')
    parser.add_argument('--config', required=True, help='Path to JSON config file with alternative and canonical names')
    parser.add_argument('--dry-run', action='store_true', help='Perform a dry run without making changes')
    parser.add_argument('--index-name', help='Override the index name from env file')
    
    args = parser.parse_args()
    
    # Setup: Load environment and configuration
    load_env(args.site)
    
    with open(args.config) as f:
        config = json.load(f)
        alternative_names = config['alternative_names']
        canonical_name = config['canonical_name']
    
    # Initialize Pinecone with new API
    pc = get_pinecone_client()
    index = get_index(pc, args.index_name)
    
    # Execute cleanup and display results
    stats = find_and_replace_authors(
        index,
        alternative_names,
        canonical_name,
        dry_run=args.dry_run
    )
    
    print("\nResults:")
    print(f"{'Author Name':<50} | {'Count':>10}")
    print("-" * 62)
    for name, count in stats.items():
        print(f"{name:<50} | {count:>10}")
    
    if args.dry_run:
        print("\nThis was a dry run. No changes were made.")
        print("To make actual changes, run without --dry-run")

if __name__ == "__main__":
    main() 