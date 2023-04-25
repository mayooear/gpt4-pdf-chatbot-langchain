if (!process.env.COLLECTION_NAME) {
  throw new Error('Missing collection name name in .env file');
}

const COLLECTION_NAME = process.env.COLLECTION_NAME ?? '';

export { COLLECTION_NAME };
