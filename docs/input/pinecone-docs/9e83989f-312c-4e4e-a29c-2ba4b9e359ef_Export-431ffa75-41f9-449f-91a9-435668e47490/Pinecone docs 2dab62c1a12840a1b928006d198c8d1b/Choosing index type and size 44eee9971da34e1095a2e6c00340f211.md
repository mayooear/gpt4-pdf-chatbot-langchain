# Choosing index type and size

# URL: [https://docs.pinecone.io/docs/choosing-index-type-and-size](https://docs.pinecone.io/docs/choosing-index-type-and-size)

# Choosing index type and size

When creating an index in Pinecone, you will need to choose the index type and size that best suits your data and use case. The index type and size determine how your data is stored and indexed, which can affect the speed and accuracy of similarity searches.

## Index types

Pinecone supports two types of indexes: `hnsw` and `lsh`. Both index types support fast similarity search on high-dimensional vectors, but they differ in their performance characteristics and trade-offs.

### HNSW

The `hnsw` index type uses the Hierarchical Navigable Small World (HNSW) algorithm to perform similarity search. HNSW is a graph-based algorithm that builds a hierarchical network of data points, where each point is connected to a small number of other points in the network. The HNSW algorithm is designed to balance search speed and accuracy, and can provide fast results even for large datasets.

### LSH

The `lsh` index type uses Locality-Sensitive Hashing (LSH) to perform similarity search. LSH is a probabilistic algorithm that hashes data points to a set of buckets based on their similarity. LSH is designed to be efficient for high-dimensional data, but may not provide the same level of accuracy as HNSW for some datasets.

## Index size

The size of your index determines how many vectors it can store and how much memory it will require. When choosing the size of your index, you will need to consider the size of your dataset, the dimensionality of your vectors, and the resources available on your system.

### Number of vectors

The number of vectors your index can store depends on the size of each vector and the amount of memory available on your system. For example, if you have 1 GB of memory available and each vector is 100 bytes, you could store approximately 10 million vectors in your index.

### Dimensionality

The dimensionality of your vectors also affects the size of your index. As the dimensionality of your vectors increases, the number of required memory grows exponentially. For example, if you double the dimensionality of your vectors, you will need to quadruple the amount of memory required to store your index.

## Choosing the right index

When choosing the index type and size for your dataset, it's important to consider your specific use case and requirements. Here are some factors to consider:

- **Accuracy**: If accuracy is your primary concern, the HNSW index type may be the best choice. HNSW is designed to provide high accuracy even for large datasets.
- **Speed**: If speed is your primary concern, the LSH index type may be the best choice. LSH can provide fast results even for very high-dimensional data.
- **Dataset size**: If you have a very large dataset, the HNSW index type may be more efficient. HNSW can handle very large datasets without sacrificing accuracy.
- **Dimensionality**: If your vectors have a high dimensionality, the LSH index type may be more efficient. LSH is designed to be efficient for high-dimensional data.

## Next steps

To learn more about how to create an index in Pinecone, check out the [documentation](https://docs.pinecone.io/docs/quickstart#step-2-set-up-your-pinecone-instance). If you have any questions or feedback, please [contact us](https://www.pinecone.io/contact/).