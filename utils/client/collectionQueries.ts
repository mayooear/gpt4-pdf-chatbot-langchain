let cachedQueries: Record<string, Record<string, string[]>> | null = null;

export async function loadQueries(
  siteId: string,
  collection: string,
): Promise<string[]> {
  if (
    cachedQueries &&
    cachedQueries[siteId] &&
    cachedQueries[siteId][collection]
  ) {
    return cachedQueries[siteId][collection];
  }

  const response = await fetch(`/data/${siteId}/${collection}_queries.txt`);
  const text = await response.text();
  const queries = text.split('\n').filter((query) => query.trim() !== '');

  if (!cachedQueries) {
    cachedQueries = {};
  }
  if (!cachedQueries[siteId]) {
    cachedQueries[siteId] = {};
  }
  cachedQueries[siteId][collection] = queries;

  return queries;
}

export async function getCollectionQueries(
  siteId: string,
  collectionConfig: Record<string, string>,
) {
  if (cachedQueries && cachedQueries[siteId]) {
    return cachedQueries[siteId];
  }

  const queries: Record<string, string[]> = {};
  for (const [key] of Object.entries(collectionConfig)) {
    queries[key] = await loadQueries(siteId, key);
  }

  if (!cachedQueries) {
    cachedQueries = {};
  }
  cachedQueries[siteId] = queries;
  return queries;
}
