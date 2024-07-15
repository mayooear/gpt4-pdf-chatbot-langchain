import os
import sys
import json
import hashlib
from pinecone import Pinecone, ServerlessSpec

from audio_utils import get_audio_metadata, get_file_hash

def create_embeddings(chunks, client):
    texts = [chunk['text'] for chunk in chunks]
    response = client.embeddings.create(input=texts, model="text-embedding-ada-002")
    return [embedding.embedding for embedding in response.data]

def load_pinecone(index_name=None):
    if not index_name:
        index_name = os.getenv('PINECONE_INGEST_INDEX_NAME')
    pc = Pinecone()
    if index_name not in pc.list_indexes().names():
        pc.create_index(index_name, dimension=1536, metric="cosine", 
                        spec=ServerlessSpec(cloud='aws', region='us-west-2'))
    return pc.Index(index_name)

def store_in_pinecone(index, chunks, embeddings, file_path, dryrun=False):
    if dryrun:
        return
    
    file_name = os.path.basename(file_path)
    file_hash = get_file_hash(file_path)
    
    # Get the title and author from metadata or fallback
    title, author = get_audio_metadata(file_path)
    
    vectors = []
    for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        content_hash = hashlib.md5(chunk['text'].encode()).hexdigest()[:8]
        chunk_id = f"audio||Treasures||{title}||{content_hash}||chunk{i+1}"
        
        vectors.append({
            'id': chunk_id,
            'values': embedding,
            'metadata': {
                'text': chunk['text'],
                'start_time': chunk['start_time'],
                'end_time': chunk['end_time'],
                'full_info': json.dumps(chunk),
                'file_name': file_name,
                'file_hash': file_hash,
                'library': "Treasures",
                'author': author,
                'type': 'audio',
                'title': title,
            }
        })

    try:
        index.upsert(vectors=vectors)
    except Exception as e:
        error_message = str(e)
        if "429" in error_message and "Too Many Requests" in error_message:
            print(f"Error in upserting vectors: {e}")
            print("You may have reached your write unit limit for the current month. Exiting script.")
            sys.exit(1)
        else:
            print(f"Error in upserting vectors: {e}")

def query_similar_chunks(index, client, query, n_results=8):
    query_embedding = client.embeddings.create(
        input=query,
        model="text-embedding-ada-002"
    ).data[0].embedding

    results = index.query(vector=query_embedding, top_k=n_results, include_metadata=True)
    return results['matches']

def clear_treasures_vectors(index):
    index.delete(delete_all=True)