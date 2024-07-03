let cachedQueries: Record<string, string[]> | null = null;

export async function loadQueries(collection: string): Promise<string[]> {
  if (cachedQueries && cachedQueries[collection]) {
    return cachedQueries[collection];
  }

  const response = await fetch(`/data/${collection}_queries.txt`);
  const text = await response.text();
  const queries = text.split('\n').filter(query => query.trim() !== '');

  if (!cachedQueries) {
    cachedQueries = {};
  }
  cachedQueries[collection] = queries;

  return queries;
}

export async function getCollectionQueries() {
  if (cachedQueries) {
    return cachedQueries;
  }

  const queries = {
    whole_library: await loadQueries('whole_library'),
    master_swami: await loadQueries('master_swami'),
  };

  cachedQueries = queries;
  return queries;
}

