# Indexes

# URL: [https://docs.pinecone.io/docs/indexes](https://docs.pinecone.io/docs/indexes)

# Indexes

In Pinecone, an index is a data structure that stores high-dimensional vectors and allows for fast similarity search. Each index has a name, a dimensionality, and an index type, and can be associated with metadata for organization and management.

## Creating an index

To create an index in Pinecone, you can use the `/indexes` endpoint with the following parameters:

- `name`: The name of the index.
- `dimension`: The dimensionality of the vectors in the index.
- `index_type`: The type of the index (`hnsw` or `lsh`).
- `metadata` (optional): A dictionary of metadata to associate with the index.

For example, to create an index called `my_index` with dimensionality 128 and HNSW index type:

```
POST /indexes
{
    "name": "my_index",
    "dimension": 128,
    "index_type": "hnsw"
}

```

This will create a new index called `my_index` with dimensionality 128 and the HNSW index type.

## Updating an index

You can update the metadata for an index using the `/indexes/{index_name}` endpoint with a `PUT` request. For example, to update the metadata for the `my_index` index:

```
PUT /indexes/my_index
{
    "metadata": {"description": "My index of image vectors"}
}

```

This will update the metadata for the `my_index` index.

## Listing indexes

To list all indexes in your Pinecone instance, you can use the `/indexes` endpoint. This will return a list of all indexes, including their name, dimensionality, index type, and metadata.

To list a specific index, you can use the `/indexes/{index_name}` endpoint with a `GET` request. This will return information about the specified index, including its name, dimensionality, index type, and metadata.

## Deleting an index

To delete an index, you can use the `/indexes/{index_name}` endpoint with a `DELETE` request. For example, to delete the `my_index` index:

```
DELETE /indexes/my_index

```

This will delete the `my_index` index and all associated data.

## Next steps

To learn more about using indexes in Pinecone, including creating indexes with custom settings, check out the [documentation](https://docs.pinecone.io/docs/indexes). If you have any questions or feedback, please [contact us](https://www.pinecone.io/contact/).