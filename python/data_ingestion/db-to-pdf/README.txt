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
   The resulting files will be in docs-anandaLib/ subfolder.

3. Move subfolder to /docs at top of tree

5. To process the embeddings and put this into production, you need to clear out the pinecone embeddings of a
   pinecone env not in production. You can use an API key not currently in production. Check your local .env file. 
   Change your .env file to point to its API key. 
   Then run:

      npm run ingest

6. Confirm that pinecone index was created

7. Switch production env var for new pinecone API key
