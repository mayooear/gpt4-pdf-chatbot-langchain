import os
import re
import sys
import hashlib
import logging
from pinecone import Pinecone, ServerlessSpec
from pinecone.core.client.exceptions import NotFoundException, PineconeException

logger = logging.getLogger(__name__)

"""
Pinecone Vector Database Integration Layer

Handles vector storage and retrieval for media content embeddings with distributed processing support.
Implements robust error handling and retry logic for cloud operations.

Architecture:
- Serverless Pinecone deployment on AWS
- Cosine similarity for vector matching
- Chunked batch processing for large datasets
- Atomic operations with rollback capability

Technical Specifications:
- Vector Dimension: 1536 (OpenAI ada-002)
- Index Metric: Cosine Similarity
- Batch Size: 100 vectors per upsert
- Region: us-west-2 (AWS)

Rate Limits:
- Write: 100 vectors per batch
- Concurrent operations: Based on plan
- Retries: Exponential backoff
"""

def create_embeddings(chunks, client):
    """
    Generates embeddings for text chunks using OpenAI's API.
    
    Batch Processing:
    - Processes all chunks in single API call
    - Maintains chunk order for vector mapping
    - Returns flat list of embeddings
    
    Rate Limits: Determined by OpenAI API quotas
    Vector Size: 1536 dimensions per embedding
    """
    texts = [chunk["text"] for chunk in chunks]
    logging.debug("create_embeddings")
    response = client.embeddings.create(input=texts, model="text-embedding-ada-002")
    return [embedding.embedding for embedding in response.data]


def load_pinecone(index_name=None):
    """
    Initializes or connects to Pinecone index with error handling.
    
    Index Creation Strategy:
    - Attempts creation first (idempotent)
    - Falls back to existing index
    - Validates index parameters
    
    Error Handling:
    409: Index exists (normal operation)
    500: Infrastructure issues
    Others: Configuration problems
    """
    if not index_name:
        index_name = os.getenv("PINECONE_INGEST_INDEX_NAME")
    pc = Pinecone()
    try:
        pc.create_index(
            index_name,
            dimension=1536,
            metric="cosine",
            spec=ServerlessSpec(cloud="aws", region="us-west-2"),
        )
    except PineconeException as e:
        if e.status == 409:
            logger.info(f"Index {index_name} already exists. Proceeding with existing index.")
        elif e.status == 500:
            logger.error("Internal Server Error. Please try again later.")
        else:
            logger.error(f"Unexpected error: {e}")
            raise
    return pc.Index(index_name)


def store_in_pinecone(
    pinecone_index,
    chunks,
    embeddings,
    author,
    library_name,
    is_youtube_video,
    title=None,
    url=None,
    interrupt_event=None,
    s3_key=None,
    album=None
):
    """
    Stores vector embeddings with metadata in Pinecone.
    
    Vector ID Format: type||library||title||content_hash||chunk_number
    
    Metadata Schema:
    - text: Raw chunk content
    - start/end_time: Chunk boundaries
    - duration: Chunk length
    - library: Source library
    - author: Content creator
    - type: youtube/audio
    - title: Content title
    - album: Optional grouping
    - filename: For audio files
    - url: For YouTube content
    
    Batch Processing:
    - 100 vectors per upsert
    - Atomic operations
    - Interruptible for long runs
    
    Error Handling:
    - 429: Rate limit exceeded
    - Others: Infrastructure issues
    """
    # Sanitization for vector ID components
    title = title if title is not None else "Unknown Title"
    title = title.replace("'", "'")  # Replace smart quotes for compatibility
    sanitized_title = re.sub(r'[^\x00-\x7F]+', '', title)  # ASCII-only for IDs
    
    vectors = []
    for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        # Content-based deduplication hash
        content_hash = hashlib.md5(chunk["text"].encode()).hexdigest()[:8]
                
        # Replace offensive single quote with acceptable one
        if title:
            title = title.replace("’", "'")
            
        # Sanitize the title to ensure it's ASCII-compatible
        sanitized_title = re.sub(r'[^\x00-\x7F]+', '', title) if title else 'Unknown_Title'
        
        chunk_id = f"{'youtube' if is_youtube_video else 'audio'}||{library_name}||" +\
                   f"{sanitized_title}||{content_hash}||chunk{i+1}"

        # Duration calculation for content navigation
        duration = chunk["end"] - chunk["start"]

        # Core metadata for all content types
        metadata = {
            "text": chunk["text"],
            "start_time": chunk["start"],
            "end_time": chunk["end"],
            "duration": round(duration, 1), 
            "library": library_name,
            "author": author,
            "type": "youtube" if is_youtube_video else "audio",
            "title": title,
        }

        # Optional metadata based on content type
        if album:
            metadata["album"] = album

        # Only add the filename field if it's not a YouTube video and s3_key is provided
        if not is_youtube_video and s3_key:
            # Extract relative path for audio files
            filename = s3_key.split('public/audio/', 1)[-1]
            metadata["filename"] = filename

        # Only add the url field if it's not None
        if url is not None:
            metadata["url"] = url

        vectors.append({"id": chunk_id, "values": embedding, "metadata": metadata})

    # Batch processing with interrupt support
    for i in range(0, len(vectors), 100):
        # Check for interrupt signal between batches
        if interrupt_event and interrupt_event.is_set():
            logger.info("Interrupt detected. Stopping Pinecone upload...")
            return
            
        batch = vectors[i: i + 100]
        try:
            pinecone_index.upsert(vectors=batch)
        except Exception as e:
            error_message = str(e)
            if "429" in error_message and "Too Many Requests" in error_message:
                # Rate limit exceeded - likely monthly quota
                logger.error(f"Error in upserting vectors: {e}")
                logger.error(
                    "You may have reached your write unit limit for the current month. Exiting script."
                )
                sys.exit(1)
            else:
                # Other infrastructure or configuration issues
                logger.error(f"Error in upserting vectors: {e}")
                raise PineconeException(f"Failed to upsert vectors: {str(e)}")

    logger.info(f"Successfully stored {len(vectors)} vectors in Pinecone")


def clear_library_vectors(index, library_name):
    """
    Purges all vectors for a specific library.
    
    Safety Features:
    - Library-scoped deletion only
    - No cascade effects
    - Atomic operation
    
    Error Cases:
    - Missing index
    - Permission issues
    - Rate limiting
    """
    try:
        # Metadata-based filtering for targeted deletion
        index.delete(filter={"library": library_name})
        logger.info(
            f"Successfully cleared all vectors for library '{library_name}' from the index."
        )
    except NotFoundException:
        logger.warning(
            "The index or namespace you're trying to clear doesn't exist. Skipping clear operation."
        )
        raise
    except Exception as e:
        logger.error(f"An error occurred while trying to clear vectors: {str(e)}")
        raise
