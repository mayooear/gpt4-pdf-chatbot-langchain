
if (!process.env.EMBEDDING_TYPE) {
  throw new Error('Missing Embedding Type index name in .env file');
}

const EMBEDDING_TYPE = process.env.EMBEDDING_TYPE ?? 'openai';//cohere
console.log(EMBEDDING_TYPE);

export { EMBEDDING_TYPE};
