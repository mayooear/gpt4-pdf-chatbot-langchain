# wmgillett-GPT-4 & LangChain - Create a ChatGPT Chatbot for Your PDF Files
This repo is a fork of [mayooear's repo - **GPT-4 & LangChain**](https://github.com/mayooear/gpt4-pdf-chatbot-langchain) which leverages the new GPT-4 api to build a chatGPT-like chatbot for multiple Large PDF files.  The goal of my forked repo is to implement some enhancements (mainly ui), refine them, and to hopefully integrate these with mayo's repo.

Mayo's repo is supported by an instructional [youtube video](https://www.youtube.com/watch?v=ih9PBGVVOO4) and a [discord group](https://discord.gg/E4Mc77qwjm) that I encourage folks to engage in.
Last I saw, there were 2000 forks and 10,000 stars for his repo - so it is very popular and deservedly so.
As I worked with this code-base, I could see the value in how it combined a front-end framework (next.js) with langChain, but there were changes I needed to make to support my own deployments of it.  The code as-is is really a proof-of-concept - especially with the front end components.  My enhancements are aimed at supporting custom deployments within a common code base.

## Current enhancement list:
### 1) Support for customizing the front page text without making code changes
- The text areas on the chat page ((title, welcome text, user input placeholder) are very important descriptors since this chatbot can interact with a wide range of pdfs (e.g legal documents, documentation, help files, books, etc.)  Currently the text for the chat page elements can only be modified within the code for the main page (`pages/index.tsx`).  And these changes would be overwritten by any updates to the repo.  My enhancement parameterizes all key page elements and allows users of this repo to specify them in the .env file.
- A [pull request](https://github.com/mayooear/gpt4-pdf-chatbot-langchain/pull/312) has been made for this change in Mayo's repo.
### 2) Support for docker and deploying to the web (e.g via fly.io). `(pending)`
### 3) More condensed UI and better automated scrolling more like ChatGPT `(pending)`
### 4) Integrating more controls for the selecting and configuring conversational chains`(pending)`

## Tech stack
The tech stack used in Mayo's repo is well-chosen and essentially unchanged - LangChain, Node, Yarn, Pinecone, Openai, LLM, and Next.js.   My only additions are optional additions related to deployment - Fly.io and Docker.

1) `LangChain` - is an app framework for LLMs (large language models) that makes it easier to build scalable AI/LLM apps and chatbots. This open-source initiative started just before the CHatGPT craze and has really taken off.  It has both a javascript/typescript and python version.  This repo leverages the javascript version.  It is important to note that LangChain is not a web-app framework - it is more of a middle-tier framework that has been plugged into a web-framework - like Next.js or Django in the python world. 
2) `Node.js` - a javascript server environment that LangChain JS runs on in this application.  Node allows for a very complete and simple local dev environment.
3) `Yarn` - the package manager used in this application - is very helpful for building and maintaining the components for this application.  
4) `Pinecone` - is a vectorstore for storing embeddings of the PDF content. Pinecone is a cloud SAAS provider with a free tier - so it is great for prototyping.  But you will need to move to a paid plan if you need to support multiple indexes.  Chroma DB is another option for a vectorstore that I have used.  Its advantage is that it is open-source and self-hosted and thus not limited in terms of indexes you can build.  But deploying apps with it is more complicated (e.g. multiple docker containers) and not currently an option for this code-base.
5) `OpenAI` - leading developer of LLMs and the chatbot ChatGPT.  Its API is integrated with the embedding processing for the pdf documents - this is separate from its many LLM models.
6) `LLMs` - Large Language models are integrated with any LangChain app and the choice of the model is independent of the embedding process.
7) `Next.js` - is a web-app framework built on top of React and manages all the front end web-components to support the chat-bot interface.  It is an excellent choice here in that it supports both Client-side and Server-side rendering and has built in routing. 
8) `Fly.io` and `Docker` - fly.io is an app hosting environment with a simple deployment workflow.  Docker is the most popular method of containerizing applications for deployment.  With these - you can take the local LangChain dev environment and deploy it to the web. Note that .env parameters will need to be added as secrets in the Fly.io environment.     

## Prerequisites
1) Node.js - version is 18 or greater.

## Installation
1. Clone the repo or download the ZIP
```
git clone [github https url]
```
2. Install packages

Install yarn globally (if you haven't already).
```
npm install yarn -g
```
Then run:
```
yarn install
```
After installation, you should now see a `node_modules` folder.

3. Set up your `.env` file (Copy `.env.example` into `.env` in your project root folder)
```
cp .env.example .env
```
 Your `.env` file should look like this: (Note this env is expanded from Mayo's version)
```
OPENAI_API_KEY=
PINECONE_API_KEY=
PINECONE_ENVIRONMENT=
PINECONE_INDEX_NAME=
PINECONE_NAME_SPACE=
# static text on chat page - change if you want new values
CHAT_PAGE_TITLE=Chat with Your Favorite Author
WELCOME_MESSAGE=Hi, what would you like to learn about this book?
USER_INPUT_PLACEHOLDER=What is the book about??
PFOOTER_URL=
FOOTER_TEXT=
```
- Visit [openai](https://help.openai.com/en/articles/4936850-where-do-i-find-my-secret-api-key) to retrieve API keys and insert them into your `.env` file.
- Visit [pinecone](https://pinecone.io/) to create and retrieve your API keys, and also retrieve your environment and index name from the dashboard.
- `Static text on chat page` - this is the main departure from the original code base - substituting the hardcoded text values with parameters from the .env file and thus outside the code base. 
`insert marked up image`

4. Modifications to the `utils/makechain.ts` are unchanged from Mayo's repo. In this regard, the `QA_PROMPT` and `modelName` are modified manually.  I am looking at methods for changing these chains dynamically for testing.
Currently this chain from Mayo's repo is built on the [Conversational Retrieval QA chain](https://js.langchain.com/docs/modules/chains/index_related_chains/conversational_retrieval).

## Convert your PDF files to embeddings

**This repo can load multiple PDF files**

1. Create a `docs` folder off the project root, add your pdf files or folders that contain pdf files.

2. Run the script `npm run ingest` to 'ingest' and embed your docs. If you run into errors troubleshoot below.
```
npm run ingest
```
3. Check Pinecone dashboard to verify your namespace and vectors have been added.

## Run the app locally `(dev)`

Once you've verified that the embeddings and content have been successfully added to your Pinecone, you can run `npm run dev` to launch the local dev environment, and access `localhost:3000` in a web browser to interact with the chat interface.
```
npm run dev
```
### Run the app in the cloud
`(details coming in next update)`

## Troubleshooting

In general, keep an eye out in the `issues` and `discussions` section of this repo for solutions.

**General errors**

- Make sure you're running the latest Node version. Run `node -v`
- Try a different PDF or convert your PDF to text first. It's possible your PDF is corrupted, scanned, or requires OCR to convert to text.
- `Console.log` the `env` variables and make sure they are exposed.
- Make sure you're using the same versions of LangChain and Pinecone as this repo.
- Check that you've created an `.env` file that contains your valid (and working) API keys, environment and index name.
- If you change `modelName` in `OpenAI`, make sure you have access to the api for the appropriate model.
- Make sure you have enough OpenAI credits and a valid card on your billings account.
- Check that you don't have multiple OPENAPI keys in your global environment. If you do, the local `env` file from the project will be overwritten by systems `env` variable.
- If you make changes to the `.env` variables - a restart of the server may be required.

**Pinecone errors**

- Make sure your pinecone dashboard `environment` and `index` match the ones in the `.env` files.
- Check that you've set the vector dimensions to `1536`.
- Make sure your pinecone namespace is in lowercase.
- Pinecone indexes of users on the Starter(free) plan are deleted after 7 days of inactivity. To prevent this, send an API request to Pinecone to reset the counter before 7 days.
- Retry from scratch with a new Pinecone project, index, and cloned repo.
- Make sure you have OpenAI API credits on your account - the openAI API is required for the ingest process.

## Credit
This repo is forked from [mayooear/gpt4-pdf-chatbot-langchain](https://github.com/mayooear/gpt4-pdf-chatbot-langchain)



