import os
import re
import sys
import hashlib
import logging
from pinecone import Pinecone, ServerlessSpec
from media_utils import get_media_metadata
from pinecone.core.client.exceptions import NotFoundException, PineconeException

logger = logging.getLogger(__name__)


def create_embeddings(chunks, client):
    texts = [chunk["text"] for chunk in chunks]
    logging.debug("create_embeddings")
    response = client.embeddings.create(input=texts, model="text-embedding-ada-002")
    return [embedding.embedding for embedding in response.data]


def load_pinecone(index_name=None):
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
    # Ensure title is a string
    title = title if title is not None else "Unknown Title"
    
    vectors = []
    for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        content_hash = hashlib.md5(chunk["text"].encode()).hexdigest()[:8]
                
        # Replace offensive single quote with acceptable one
        if title:
            title = title.replace("’", "'")
            
        # Sanitize the title to ensure it's ASCII-compatible
        sanitized_title = re.sub(r'[^\x00-\x7F]+', '', title) if title else 'Unknown_Title'
        
        chunk_id = f"{'youtube' if is_youtube_video else 'audio'}||{library_name}||" +\
                   f"{sanitized_title}||{content_hash}||chunk{i+1}"

        # Calculate the duration of the chunk
        duration = chunk["end"] - chunk["start"]

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

        # Add album to metadata if it's provided
        if album:
            metadata["album"] = album

        # Only add the filename field if it's not a YouTube video and s3_key is provided
        if not is_youtube_video and s3_key:
            # Extract the path after 'public/audio/'
            filename = s3_key.split('public/audio/', 1)[-1]
            metadata["filename"] = filename

        # Only add the url field if it's not None
        if url is not None:
            metadata["url"] = url

        vectors.append({"id": chunk_id, "values": embedding, "metadata": metadata})

    for i in range(0, len(vectors), 100):
        if interrupt_event and interrupt_event.is_set():
            logger.info("Interrupt detected. Stopping Pinecone upload...")
            return
        batch = vectors[i: i + 100]
        try:
            pinecone_index.upsert(vectors=batch)
        except Exception as e:
            error_message = str(e)
            if "429" in error_message and "Too Many Requests" in error_message:
                logger.error(f"Error in upserting vectors: {e}")
                logger.error(
                    "You may have reached your write unit limit for the current month. Exiting script."
                )
                sys.exit(1)
            else:
                logger.error(f"Error in upserting vectors: {e}")
                raise PineconeException(f"Failed to upsert vectors: {str(e)}")

    logger.info(f"Successfully stored {len(vectors)} vectors in Pinecone")


def clear_library_vectors(index, library_name):
    try:
        #        index.delete(delete_all=True, namespace=None)
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
