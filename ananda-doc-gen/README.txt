This directory is for generating the PDF documents from a mysql database dump of the ananda library wordpress site.

The process is:

1. set up your mysql local db with the wordpress data

1a. modify schema:

   ALTER TABLE wp_posts 
   MODIFY COLUMN post_modified DATETIME NULL,
   MODIFY COLUMN post_modified_gmt DATETIME NULL,
   ADD COLUMN permalink VARCHAR(255),
   ADD COLUMN author_name VARCHAR(255);

2. from this directory, run python db-to-pdfs.py to generate the PDF file set. 
   The resulting files will be in docs/ subfolder.

3. optionally filter by author, e.g., we run this command to select only content from kriyananda and yogananda:

    python filter-pdfs-to-new-dir.py --source_dir docs-anandaLib --authors 'yogananda,kriyananda,walters'

   The resulting files will be in docs-anandaLib-filtered/ subfolder.

4. take the appropriate subfolder and move it to /docs at top of tree

5. To process the embeddings and put this into production, you need to clear out the pinecone embeddings of a
   pinecone env not in production. We currently have separate pinecone accounts for each context, one for
   Swami and Master, and another that includes all docs. Check your local .env file. Then
   select a spare pinecone corpus/env login that's not in use and delete the dataset. 
   Create fresh one with same name and 1536 for size. Change your .env file to point to its API key. 
   Then run:

      yarn run ingest someContext

   someContext would be swami_master or whole_library or other options as shown in pinecone-client.ts

6. Confirm that pinecone index was created

7. Switch production env var for appropriate pinecone API (e.g., for PINECONE_API_KEY_MASTER_SWAMI) 
   to point to the new corpus/data.
