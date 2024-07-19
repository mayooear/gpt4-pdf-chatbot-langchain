import os
import re
import sys
import json
import hashlib
import logging
from pinecone import Pinecone, ServerlessSpec
from media_utils import get_media_metadata, get_file_hash
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
    if index_name not in pc.list_indexes().names():
        logger.info(f"Creating pinecone index {index_name}")
        pc.create_index(
            index_name,
            dimension=1536,
            metric="cosine",
            spec=ServerlessSpec(cloud="aws", region="us-west-2"),
        )
    return pc.Index(index_name)


def store_in_pinecone(
    index,
    chunks,
    embeddings,
    file_path,
    author,
    library_name,
    is_youtube_video,
    youtube_id=None,
    title=None,
    duration=None,
    url=None,
    interrupt_event=None,
):
    vectors = []
    for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        content_hash = hashlib.md5(chunk["text"].encode()).hexdigest()[:8]
        
        # Replace offensive single quote with acceptable one
        if title:
            title = title.replace("’", "'")
            
        # Sanitize the title to ensure it's ASCII-compatible
        sanitized_title = re.sub(r'[^\x00-\x7F]+', '', title) if title else 'Unknown_Title'
        
        chunk_id = f"{'youtube' if is_youtube_video else 'audio'}||{library_name}||{sanitized_title}||{content_hash}||chunk{i+1}"

        # print chunk, but not the words list
        chunk_copy = {k: v for k, v in chunk.items() if k != "words"}
        logger.debug(f"store_in_pinecone: chunk {i+1} of {len(chunks)}: {chunk_copy}")

        metadata = {
            "text": chunk["text"],
            "start_time": chunk["start"],
            "end_time": chunk["end"],
            "full_info": json.dumps(chunk),
            "library": library_name,
            "author": author,
            "type": "youtube" if is_youtube_video else "audio",
            "title": title,
            "filename": "" if not file_path else os.path.basename(file_path),
        }

        # Only add the url field if it's not None
        if url is not None:
            metadata["url"] = url

        vectors.append({"id": chunk_id, "values": embedding, "metadata": metadata})

    for i in range(0, len(vectors), 100):
        if interrupt_event and interrupt_event.is_set():
            logger.info("Interrupt detected. Stopping Pinecone upload...")
            return
        batch = vectors[i : i + 100]
        try:
            index.upsert(vectors=batch)
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