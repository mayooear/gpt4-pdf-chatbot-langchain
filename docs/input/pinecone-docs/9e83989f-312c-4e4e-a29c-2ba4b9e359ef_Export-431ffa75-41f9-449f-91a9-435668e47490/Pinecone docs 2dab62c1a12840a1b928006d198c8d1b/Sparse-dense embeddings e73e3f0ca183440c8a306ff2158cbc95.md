# Sparse-dense embeddings

# URL: [https://docs.pinecone.io/docs/hybrid-search](https://docs.pinecone.io/docs/hybrid-search)

# Hybrid search

Pinecone supports hybrid search, which allows you to combine the results of multiple similarity search algorithms to improve accuracy and relevance.

## How hybrid search works

In Pinecone, you can perform a hybrid search by combining the results of two or more indexes. When you perform a hybrid search, Pinecone retrieves the top results from each index and combines them to create a final set of results.

To perform a hybrid search, you must specify the names of the indexes you want to combine, as well as the number of results to retrieve from each index. For example, to perform a hybrid search with two indexes (`index1` and `index2`) and retrieve the top 10 results from each index:

```
POST /query
{
    "index_names": ["index1", "index2"],
    "query_vector": [0.5, 0.5],
    "top_k": 10,
    "weights": [0.5, 0.5]
}

```

This will retrieve the top 10 results from both `index1` and `index2`, and combine them using equal weights.

## Weighting results

When performing a hybrid search, you can assign weights to each index to control the contribution of each index to the final set of results. The weights must be specified as a list of floats, with one weight per index. For example, to perform a hybrid search with two indexes (`index1` and `index2`) and assign a weight of 0.8 to `index1` and a weight of 0.2 to `index2`:

```
POST /query
{
    "index_names": ["index1", "index2"],
    "query_vector": [0.5, 0.5],
    "top_k": 10,
    "weights": [0.8, 0.2]
}

```

This will retrieve the top 10 results from both `index1` and `index2`, and combine them using a weight of 0.8 for `index1` and a weight of 0.2 for `index2`.

## Choosing indexes for hybrid search

When choosing indexes to combine in a hybrid search, it's important to consider the characteristics of each index, such as their performance, accuracy, and relevance to your use case. You may also want to experiment with different combinations of indexes and weights to find the best combination for your specific use case.

## Next steps

To learn more about using hybrid search in Pinecone, check out the [documentation](https://docs.pinecone.io/docs/hybrid-search). If you have any questions or feedback, please [contact us](https://www.pinecone.io/contact/).