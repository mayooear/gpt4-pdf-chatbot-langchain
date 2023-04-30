# Python client

# URL: [https://docs.pinecone.io/docs/python-client](https://docs.pinecone.io/docs/python-client)

# Python client

The Pinecone Python client is a library that provides a Python interface to the Pinecone API. With the Pinecone Python client, you can easily perform similarity search on high-dimensional data using Python.

## Installation

You can install the Pinecone Python client using pip:

```
pip install pinecone-client

```

## Quickstart

To get started with the Pinecone Python client, follow these steps:

1. [Sign up](https://www.pinecone.io/start/) for a Pinecone account.
2. [Create an index](https://docs.pinecone.io/docs/quickstart#step-2-set-up-your-pinecone-instance) using the Pinecone API or the [Pinecone Console](https://www.pinecone.io/console/).
3. Install the Pinecone Python client using pip.
4. Connect to your Pinecone instance using the `pinecone.init` method:
    
    ```
    import pinecone
    
    pinecone.init(api_key="<YOUR_API_KEY>")
    
    ```
    
    Replace `<YOUR_API_KEY>` with your Pinecone API key.
    
5. Add data to your index using the `pinecone.upsert` method:
    
    ```
    data = {
        "id1": [1.0, 2.0],
        "id2": [3.0, 4.0],
        "id3": [5.0, 6.0],
    }
    
    pinecone.upsert(index_name="<YOUR_INDEX_NAME>", data=data)
    
    ```
    
    Replace `<YOUR_INDEX_NAME>` with the name of the index you created in step 2.
    
6. Perform a similarity search using the `pinecone.query` method:
    
    ```
    query_embedding = [0.5, 0.5]
    results = pinecone.query(index_name="<YOUR_INDEX_NAME>", query_embedding=query_embedding, top_k=2)
    print(results)
    
    ```
    
    This will search for the data point closest to the query embedding `[0.5, 0.5]` in your index and return the top two results.
    

For more information on using the Pinecone Python client, including a detailed API reference, check out the [documentation](https://docs.pinecone.io/docs/python-client).