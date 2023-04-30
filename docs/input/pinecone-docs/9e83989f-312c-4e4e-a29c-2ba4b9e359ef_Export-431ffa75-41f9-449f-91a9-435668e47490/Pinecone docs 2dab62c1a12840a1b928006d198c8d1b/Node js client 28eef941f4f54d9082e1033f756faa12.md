# Node.js client

URL: [https://docs.pinecone.io/docs/node-client](https://docs.pinecone.io/docs/node-client)

# Node.js client

The Pinecone Node.js client is a library that provides a Node.js interface to the Pinecone API. With the Pinecone Node.js client, you can easily perform similarity search on high-dimensional data using Node.js.

## Installation

You can install the Pinecone Node.js client using npm:

```
npm install pinecone-node-client

```

## Quickstart

To get started with the Pinecone Node.js client, follow these steps:

1. [Sign up](https://www.pinecone.io/start/) for a Pinecone account.
2. [Create an index](https://docs.pinecone.io/docs/quickstart#step-2-set-up-your-pinecone-instance) using the Pinecone API or the [Pinecone Console](https://www.pinecone.io/console/).
3. Install the Pinecone Node.js client using npm.
4. Connect to your Pinecone instance using the `init` method:
    
    ```
    const pinecone = require("pinecone-node-client");
    
    pinecone.init({ apiKey: "<YOUR_API_KEY>" });
    
    ```
    
    Replace `<YOUR_API_KEY>` with your Pinecone API key.
    
5. Add data to your index using the `upsert` method:
    
    ```
    const data = [
      { id: "id1", vector: [1.0, 2.0] },
      { id: "id2", vector: [3.0, 4.0] },
      { id: "id3", vector: [5.0, 6.0] }
    ];
    
    await pinecone.upsert({
      indexName: "<YOUR_INDEX_NAME>",
      data
    });
    
    ```
    
    Replace `<YOUR_INDEX_NAME>` with the name of the index you created in step 2.
    
6. Perform a similarity search using the `query` method:
    
    ```
    const queryEmbedding = [0.5, 0.5];
    const results = await pinecone.query({
      indexName: "<YOUR_INDEX_NAME>",
      queryEmbedding,
      topK: 2
    });
    console.log(results);
    
    ```
    
    This will search for the data point closest to the query embedding `[0.5, 0.5]` in your index and return the top two results.
    

For more information on using the Pinecone Node.js client, including a detailed API reference, check out the [documentation](https://docs.pinecone.io/docs/node-client).