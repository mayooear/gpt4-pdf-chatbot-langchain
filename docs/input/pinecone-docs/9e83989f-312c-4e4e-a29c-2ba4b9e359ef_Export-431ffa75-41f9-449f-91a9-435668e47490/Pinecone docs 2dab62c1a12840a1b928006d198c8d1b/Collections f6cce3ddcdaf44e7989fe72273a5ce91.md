# Collections

# URL: [https://docs.pinecone.io/docs/collections](https://docs.pinecone.io/docs/collections)

# Collections

In Pinecone, a collection is a group of indexes that share the same schema and metadata. Collections are useful for organizing and managing your indexes, especially if you have a large number of indexes.

## Creating a collection

To create a collection, simply provide a name and optional metadata when you create your first index in the collection. For example, you could create a collection called `my_collection` with metadata `{"description": "My collection of image indexes"}`:

```
POST /indexes
{
    "name": "my_index",
    "dimension": 128,
    "metadata": {"description": "My first index in my_collection"},
    "collection": "my_collection"
}

```

This will create a new index called `my_index` in the `my_collection` collection with the specified metadata.

## Listing collections and indexes

To list your collections and indexes, you can use the `/indexes` endpoint with the `collection` query parameter. For example, to list all indexes in the `my_collection` collection:

```
GET /indexes?collection=my_collection

```

This will return a list of all indexes in the `my_collection` collection.

## Updating collections

You can update the metadata for a collection using the `/collections` endpoint. For example, to update the description for the `my_collection` collection:

```
PUT /collections/my_collection
{
    "metadata": {"description": "My updated collection of image indexes"}
}

```

This will update the metadata for the `my_collection` collection.

## Deleting collections

To delete a collection, you must first delete all indexes in the collection. You can do this by listing the indexes in the collection and deleting them one by one using the `/indexes/{index_name}` endpoint. Once all indexes in the collection have been deleted, you can delete the collection using the `/collections/{collection_name}` endpoint. For example, to delete the `my_collection` collection:

```
DELETE /collections/my_collection

```

## Next steps

To learn more about using collections in Pinecone, check out the [documentation](https://docs.pinecone.io/docs/collections). If you have any questions or feedback, please [contact us](https://www.pinecone.io/contact/).