let cachedQueries: Record<string, Record<string, string[]>> | null = null;

export async function loadQueries(
  siteId: string,
  collection: string,
): Promise<string[]> {
  console.log(`Loading queries for ${siteId}: ${collection}`);
  if (
    cachedQueries &&
    cachedQueries[siteId] &&
    cachedQueries[siteId][collection]
  ) {
    console.log(
      `Loaded ${cachedQueries[siteId][collection].length} cached queries for ${siteId}: ${collection}`,
    );
    return cachedQueries[siteId][collection];
  }

  const response = await fetch(`/data/${siteId}/${collection}_queries.txt`);
  const text = await response.text();
  const queries = text.split('\n').filter((query) => query.trim() !== '');
  console.log(`Loaded ${queries.length} queries for ${siteId}: ${collection}`);

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
  console.log('getCollectionQueries called with:', siteId, collectionConfig);
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
