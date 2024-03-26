This directory is for generating the PDF documents from a mysql database dump of the ananda library wordpress site.

The process is:

1. set up your mysql local db with the wordpress data

2. from this directory, run python db-to-pdfs.py to generate the PDF file set. 
   The resulting files will be in docs/ subfolder.

3. optionally filter by author, e.g., we run this command to select only content from kriyananda and yogananda:

    python filter-pdfs-to-new-dir.py --source_dir docs-anandaLib --authors 'yogananda,kriyananda,walters'

   The resulting files will be in docs-anandaLib-filtered/ subfolder.

4. take the appropriate subfolder and move it to /docs at top of tree

5. To process the embeddings and put this into production, you need to clear out the pinecone embeddings of a
   pinecone env not in production. We currently have two pinecone accounts for the two corpuses. 
   You can check vercel or your local .env file if that's up to date. Then
   select the other pinecone corpus/env login and delete the dataset. Create fresh one with same name and 
   1536 for size. Change your .env file to point to its API key. Then run:

   yarn run ingest

6. Confirm that pinecone index was created

7. Switch production env var for pinecone API to point to the new corpus/data.

