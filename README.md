# GPT-4 & LangChain - Create a ChatGPT Chatbot for Your PDF Docs

Use the new GPT-4 api to build a chatGPT chatbot for Large PDF docs (56 pages used in this example).

Tech stack used includes LangChain, Pinecone, Typescript, Openai, and Next.js. LangChain is a framework that makes it easier to build scalable AI/LLM apps and chatbots. Pinecone is a vectorstore for storing embeddings and your PDF in text to later retrieve similar docs.

[Tutorial video](https://www.youtube.com/watch?v=ih9PBGVVOO4)

[Get in touch via twitter if you have questions](https://twitter.com/mayowaoshin)

The visual guide of this repo and tutorial is in the `visual guide` folder.

## Development

1. Clone the repo

```
git clone [github https url]
```

2. Install packages

```
pnpm install
```

3. Set up your `.env` file

- Copy `.env.example` into `.env`
  Your `.env` file should look like this:

```
OPENAI_API_KEY=

PINECONE_API_KEY=
PINECONE_ENVIRONMENT=

```

- Visit [openai](https://help.openai.com/en/articles/4936850-where-do-i-find-my-secret-api-key) to retrieve API keys and insert into your `.env` file.
- Visit [pinecone](https://pinecone.io/) to create and retrieve your API keys.

4. In the `config` folder, replace the `PINECONE_INDEX_NAME` and `PINECONE_NAME_SPACE` with your own details from your pinecone dashboard.

5. In `utils/makechain.ts` chain change the `QA_PROMPT` for your own usecase. Change `modelName` in `new OpenAIChat` to a different api model if you don't have access to `gpt-4`.

## Convert your PDF to embeddings

1. In `docs` folder replace the pdf with your own pdf doc.

2. In `scripts/ingest-data.ts` replace `filePath` with `docs/{yourdocname}.pdf`

3. Run the script `npm run ingest` to 'ingest' and embed your docs

4. Check Pinecone dashboard to verify your namespace and vectors have been added.

## Run the app

Once you've verified that the embeddings and content have been successfully added to your Pinecone, you can run the app `npm run dev` to launch the local dev environment and then type a question in the chat interface.

## Credit

Frontend of this repo is inspired by [langchain-chat-nextjs](https://github.com/zahidkhawaja/langchain-chat-nextjs)
