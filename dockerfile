From node:20.1.0-alpine3.17

# Create non-root group and user
RUN addgroup -S bot \
&& adduser -D -S -h /var/cache/bot -s /sbin/nologin -G bot --uid 1001 bot 

# Make Port accessable 
EXPOSE 3000/tcp

# Setting env.Variables
ENV PORT=3000
ENV HOST='localhost'
# ENV OPENAI_API_KEY= <OPENAI_API_KEY>
# ENV PINECONE_API_KEY=<PINECONE_API_KEY>
# ENV PINECONE_ENVIRONMENT=<PINECONE_ENVIRONMENT>
# ENV PINECONE_INDEX_NAME=<PINECONE_INDEX_NAME>


# Add some useful tools
RUN apk add --no-cache bash musl curl && \
    npm i -g pm2@5.3.0

# Copy project files to directory path 
COPY . /usr/share/gpt4-pdf-chatbot-langchain 

# Change directory to project directory
WORKDIR /usr/share/gpt4-pdf-chatbot-langchain 

# Install dependancies
RUN yarn add sharp && yarn install && npm cache clean --force && npm cache verify && \
    # workaround for Nextjs cache folder issue https://github.com/vercel/next.js/issues/10111
    mkdir -p /usr/share/gpt4-pdf-chatbot-langchain/.next/cache/images && chmod -R 777 /usr/share/gpt4-pdf-chatbot-langchain/.next/cache/images

# Ingest documents and build Next app
RUN npm run ingest & npm run build

USER 1001

CMD ["pm2-runtime", "start", "yarn --interpreter bash start"]