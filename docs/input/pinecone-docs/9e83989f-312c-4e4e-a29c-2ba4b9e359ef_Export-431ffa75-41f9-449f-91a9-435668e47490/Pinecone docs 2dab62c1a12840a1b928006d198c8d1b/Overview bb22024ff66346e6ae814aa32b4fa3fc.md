# Overview

# URL
[https://docs.pinecone.io/docs/overview](https://docs.pinecone.io/docs/overview)

# Quickstart

## Introduction

This guide will walk you through the basic steps required to start using Pinecone, from setting up an account to performing your first similarity search.

## Prerequisites

Before you begin, make sure you have the following:

- A Pinecone account. If you don't have one, [sign up here](https://www.pinecone.io/start/).
- Python 3.6 or later installed on your local machine.

## Step 1: Install the Pinecone SDK

To install the Pinecone SDK, run the following command:

```
pip install pinecone-client

```

## Step 2: Set up your Pinecone instance

After you have installed the Pinecone SDK, you can set up your Pinecone instance by running the following code:

```
import pinecone

pinecone.init(api_key="<YOUR_API_KEY>")
pinecone.create_index(index_name="<YOUR_INDEX_NAME>", dimension=2)

```

Replace `<YOUR_API_KEY>` with your Pinecone API key, which you can find in the [Pinecone Console](https://www.pinecone.io/console/). Replace `<YOUR_INDEX_NAME>` with the name you want to give your index.

## Step 3: Add data to your index

To add data to your index, you can use the `upsert` method:

```
data = {
    "id1": [1.0, 2.0],
    "id2": [3.0, 4.0],
    "id3": [5.0, 6.0],
}

pinecone.upsert(index_name="<YOUR_INDEX_NAME>", data=data)

```

In this example, we are adding three data points to the index. Each data point is represented by a unique ID and a list of values.

## Step 4: Perform a similarity search

To perform a similarity search, you can use the `query` method:

```
query_embedding = [0.5, 0.5]
results = pinecone.query(index_name="<YOUR_INDEX_NAME>", query_embedding=query_embedding, top_k=2)
print(results)

```

In this example, we are performing a similarity search for the data point closest to the query embedding `[0.5, 0.5]`. The `top_k` parameter specifies that we want to return the top two results.

## Next steps

Congratulations, you have completed the Pinecone quickstart! To learn more about Pinecone and its features, check out the [Pinecone documentation](https://docs.pinecone.io/). If you have any questions or feedback, please [contact us](https://www.pinecone.io/contact/).