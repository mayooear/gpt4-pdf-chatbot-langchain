# AI PDF Chatbot & Agent Powered by LangChain and LangGraph

This monorepo is a customizable template example of an AI chatbot agent that "ingests" PDF documents, stores embeddings in a vector database (Supabase), and then answers user queries using OpenAI (or another LLM provider) utilising LangChain and LangGraph as orchestration frameworks.

This template is also an accompanying example to the book [Learning LangChain (O'Reilly)](https://www.oreilly.com/library/view/learning-langchain/9781098167271): Building AI and LLM applications with LangChain and LangGraph.

**Here's what the Chatbot UI looks like:**

<img width="1096" alt="Screenshot 2025-02-20 at 05 39 55" src="https://github.com/user-attachments/assets/3a9ddea7-b718-476b-bdae-38839be20c12" />

## Table of Contents

1. [Features](#features)
2. [Architecture Overview](#architecture-overview)
3. [Prerequisites](#prerequisites)
4. [Installation](#installation)
5. [Environment Variables](#environment-variables)
   - [Frontend Variables](#frontend-variables)
   - [Backend Variables](#backend-variables)
6. [Local Development](#local-development)
   - [Running the Backend](#running-the-backend)
   - [Running the Frontend](#running-the-frontend)
7. [Usage](#usage)
   - [Uploading/Ingesting PDFs](#uploadingingesting-pdfs)
   - [Asking Questions](#asking-questions)
   - [Viewing Chat History](#viewing-chat-history)
8. [Production Build & Deployment](#production-build--deployment)
9. [Customizing the Agent](#customizing-the-agent)
10. [Troubleshooting](#troubleshooting)
11. [Next Steps](#next-steps)

---

## Features

- **Document Ingestion Graph**: Upload and parse PDFs into `Document` objects, then store vector embeddings into a vector database (we use Supabase in this example).
- **Retrieval Graph**: Handle user questions, decide whether to retrieve documents or give a direct answer, then generate concise responses with references to the retrieved documents.
- **Streaming Responses**: Real-time streaming of partial responses from the server to the client UI.
- **LangGraph Integration**: Built using LangGraph’s state machine approach to orchestrate ingestion and retrieval, visualise your agentic workflow, and debug each step of the graph.  
- **Next.js Frontend**: Allows file uploads, real-time chat, and easy extension with React components and Tailwind.

---

## Architecture Overview

```ascii
┌─────────────────────┐    1. Upload PDFs    ┌───────────────────────────┐
│Frontend (Next.js)   │ ────────────────────> │Backend (LangGraph)       │
│ - React UI w/ chat  │                      │ - Ingestion Graph         │
│ - Upload .pdf files │ <────────────────────┤   + Vector embedding via  │
└─────────────────────┘    2. Confirmation   │     SupabaseVectorStore   │
(storing embeddings in DB)

┌─────────────────────┐    3. Ask questions  ┌───────────────────────────┐
│Frontend (Next.js)   │ ────────────────────> │Backend (LangGraph)       │
│ - Chat + SSE stream │                      │ - Retrieval Graph         │
│ - Display sources   │ <────────────────────┤   + Chat model (OpenAI)   │
└─────────────────────┘ 4. Streamed answers  └───────────────────────────┘

```
- **Supabase** is used as the vector store to store and retrieve relevant documents at query time.  
- **OpenAI** or **MiniMax** (or other LLM providers) is used for language modeling.
- **LangGraph** orchestrates the "graph" steps for ingestion, routing, and generating responses.  
- **Next.js** (React) powers the user interface for uploading PDFs and real-time chat.

The system consists of:
- **Backend**: A Node.js/TypeScript service that contains LangGraph agent "graphs" for:
  - **Ingestion** (`src/ingestion_graph.ts`) - handles indexing/ingesting documents
  - **Retrieval** (`src/retrieval_graph.ts`) - question-answering over the ingested documents
  - **Configuration** (`src/shared/configuration.ts`) - handles configuration for the backend api including model providers and vector stores
- **Frontend**: A Next.js/React app that provides a web UI for users to upload PDFs and chat with the AI.
---

## Prerequisites

1. **Node.js v18+** (we recommend Node v20).
2. **Yarn** (or npm, but this monorepo is pre-configured with Yarn).
3. **Supabase project** (if you plan to store embeddings in Supabase; see [Setting up Supabase](https://supabase.com/docs/guides/getting-started)).
   - You will need:
     - `SUPABASE_URL`
     - `SUPABASE_SERVICE_ROLE_KEY`
     - A table named `documents` and a function named `match_documents` for vector similarity search (see [LangChain documentation for guidance on setting up the tables](https://js.langchain.com/docs/integrations/vectorstores/supabase/)).
4. **LLM API Key** — one of the following:
   - [OpenAI API Key](https://platform.openai.com/)
   - [MiniMax API Key](https://platform.minimax.io/) (OpenAI-compatible; models: `MiniMax-M2.5`, `MiniMax-M2.5-highspeed`)
5. **LangChain API Key** (free and optional, but highly recommended for debugging and tracing your LangChain and LangGraph applications). Learn more [here](https://docs.smith.langchain.com/administration/how_to_guides/organization_management/create_account_api_key)

---

## Installation

1. **Clone** the repository:

   ```bash
   git clone https://github.com/mayooear/ai-pdf-chatbot-langchain.git
   cd ai-pdf-chatbot-langchain
   ```

2.	Install dependencies (from the monorepo root):

yarn install

	3.	Configure environment variables in both backend and frontend. See .`env.example` files for details.

## Environment Variables

The project relies on environment variables to configure keys and endpoints. Each sub-project (backend and frontend) has its own .env.example. Copy these to .env and fill in your details.

### Frontend Variables

Create a .env file in frontend:

`cp frontend/.env.example frontend/.env`

```
    NEXT_PUBLIC_LANGGRAPH_API_URL=http://localhost:2024
    LANGCHAIN_API_KEY=your-langsmith-api-key-here # Optional: LangSmith API key
    LANGGRAPH_INGESTION_ASSISTANT_ID=ingestion_graph
    LANGGRAPH_RETRIEVAL_ASSISTANT_ID=retrieval_graph

    LANGCHAIN_TRACING_V2=true # Optional: Enable LangSmith tracing

    LANGCHAIN_PROJECT="pdf-chatbot" # Optional: LangSmith project name
```

### Backend Variables

Create a .env file in backend:

`cp backend/.env.example backend/.env`

```
    OPENAI_API_KEY=your-openai-api-key-here
    MINIMAX_API_KEY=your-minimax-api-key-here  # Optional: for MiniMax provider
    SUPABASE_URL=your-supabase-url-here
    SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key-here

    LANGCHAIN_TRACING_V2=true # Optional: Enable LangSmith tracing

    LANGCHAIN_PROJECT="pdf-chatbot" # Optional: LangSmith project name
```

**Explanation of Environment Variables:**

-   `NEXT_PUBLIC_LANGGRAPH_API_URL`: The URL where your LangGraph backend server is running.  Defaults to `http://localhost:2024` for local development. 
-   `LANGCHAIN_API_KEY`: Your LangSmith API key.  This is optional, but highly recommended for debugging and tracing your LangChain and LangGraph applications.
-   `LANGGRAPH_INGESTION_ASSISTANT_ID`: The ID of the LangGraph assistant for document ingestion. Default is `ingestion_graph`.
-   `LANGGRAPH_RETRIEVAL_ASSISTANT_ID`: The ID of the LangGraph assistant for question answering. Default is `retrieval_graph`.
-   `LANGCHAIN_TRACING_V2`:  Enable tracing to debug your application on the LangSmith platform.  Set to `true` to enable.
-   `LANGCHAIN_PROJECT`:  The name of your LangSmith project.
-   `OPENAI_API_KEY`: Your OpenAI API key.
-   `MINIMAX_API_KEY`: Your MiniMax API key (optional — only needed when using `minimax/` model prefix). Get one at [platform.minimax.io](https://platform.minimax.io).
-   `SUPABASE_URL`: Your Supabase URL.
-   `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key.



## Local Development

This monorepo uses Turborepo to manage both backend and frontend projects. You can run them separately for development.

### Running the Backend

1.	Navigate to backend:

```bash
cd backend
```

2.	Install dependencies (already done if you ran yarn install at the root).

3.	Start LangGraph in dev mode:

```bash
yarn langgraph:dev
```

This will launch a local LangGraph server on port 2024 by default. It should redirect you to a UI for interacting with the LangGraph server. [Langgraph studio guide](https://langchain-ai.github.io/langgraph/concepts/langgraph_studio/)

### Running the Frontend

1. Navigate to frontend:

```bash
cd frontend
```

2. Start the Next.js development server:

```bash
yarn dev
```

This will start a local Next.js development server (by default on port 3000).

Access the UI in your browser at http://localhost:3000.

## Usage

Once both services are running:

1. Use langgraph studio UI to interact with the LangGraph server and ensure the workflow is working as expected.

2. Navigate to http://localhost:3000 to use the chatbot UI.

3. Upload a small PDF document via the file upload button at the bottom of the page. This will trigger the ingestion graph to extract the text and store the embeddings in Supabase via the frontend `app/api/ingest` route.
	
4. After the ingestion is complete, ask questions in the chat input.

5. The chatbot will trigger the retrieval graph via the `app/api/chat` route to retrieve the most relevant documents from the vector database and use the relevant PDF context (if needed) to answer.


### Uploading/Ingesting PDFs

Click on the paperclip icon in the chat input area.

Select one or more PDF files to upload ensuring a total of max 5, each under 10MB (you can change these threshold values in the `app/api/ingest` route).

The backend processes the PDFs, extracts text, and stores embeddings in Supabase (or your chosen vector store).

### Asking Questions

- Type your question in the chat input field.
- Responses stream in real time. If the system retrieved documents, you’ll see a link to “View Sources” for each chunk of text used in the answer.

### Viewing Chat History

- The system creates a unique thread per user session (frontend). All messages are kept in the state for the session.
- For demonstration purposes, the current example UI does not store the entire conversation beyond the local thread state and is not persistent across sessions. You can extend it to persist threads in a database. However, the "ingested documents" are persistent across sessions as they are stored in a vector database.


## Deploying the Backend

To deploy your LangGraph agent to a cloud service, you can either use LangGraph's cloud as per this [guide](https://langchain-ai.github.io/langgraph/cloud/quick_start/?h=studio#deploy-to-langgraph-cloud) or self-host it as per this [guide](https://langchain-ai.github.io/langgraph/how-tos/deploy-self-hosted/).

## Deploying the Frontend
The frontend can be deployed to any hosting that supports Next.js (Vercel, Netlify, etc.).

Make sure to set relevant environment variables in your deployment environment. In particular, ensure `NEXT_PUBLIC_LANGGRAPH_API_URL` is pointing to your deployed backend URL.

## Customizing the Agent

You can customize the agent on the backend and frontend.

### Backend

- In the configuration file `src/shared/configuration.ts`, you can change the default configs i.e. the vector store, k-value, and filter kwargs, shared between the ingestion and retrieval graphs. On the backend, configs can be used in each node of the graph workflow or from frontend, you can pass a config object into the graph's client.
- You can adjust the prompts in the `src/retrieval_graph/prompts.ts` file.
- If you'd like to change the retrieval model, you can do so in the `src/shared/retrieval.ts` file by adding another retriever function that encapsulates the desired client for the vector store and then updating the `makeRetriever` function to return the new retriever.


### Frontend

- You can modify the file upload restrictions in the `app/api/ingest` route.
- In `constants/graphConfigs.ts`, you can change the default config objects sent to the ingestion and retrieval graphs. These include the model provider, k value (no of source documents to retrieve), and retriever provider (i.e. vector store).

#### Switching LLM Providers

The `queryModel` config uses a `provider/model-name` format. Supported providers:

| Provider | Example `queryModel` | API Key Env |
| --- | --- | --- |
| OpenAI | `openai/gpt-4o` | `OPENAI_API_KEY` |
| MiniMax | `minimax/MiniMax-M2.5` | `MINIMAX_API_KEY` |

To use MiniMax, set `MINIMAX_API_KEY` in `backend/.env` and change `queryModel` in the frontend config:

```ts
// frontend/constants/graphConfigs.ts
export const retrievalAssistantStreamConfig = {
  queryModel: 'minimax/MiniMax-M2.5',  // or 'minimax/MiniMax-M2.5-highspeed'
  retrieverProvider: 'supabase',
  k: 5,
};
```


## Troubleshooting
1. .env Not Loaded
   - Make sure you copied .env.example to .env in both backend and frontend.
   - Check your environment variables are correct and restart the dev server.

2. Supabase Vector Store
   - Ensure you have configured your Supabase instance with the documents table and match_documents function. Check the official LangChain docs on Supabase integration.

3. OpenAI Errors
   - Double-check your OPENAI_API_KEY. Make sure you have enough credits/quota.

4. LangGraph Not Running
   - If yarn langgraph:dev fails, confirm your Node version is >= 18 and that you have all dependencies installed.

5. Network Errors
   - Frontend must point to the correct NEXT_PUBLIC_LANGGRAPH_API_URL. By default, it is http://localhost:2024.

## Next Steps

If you'd like to contribute to this project, feel free to open a pull request. Ensure it is well documented and includes tests in the test files.

If you'd like to learn more about building AI chatbots and agents with LangChain and LangGraph, check out the book [Learning LangChain (O'Reilly)](https://www.oreilly.com/library/view/learning-langchain/9781098167271/).

