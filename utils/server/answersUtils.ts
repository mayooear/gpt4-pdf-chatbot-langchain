import { db } from '@/services/firebase';
import firebase from 'firebase-admin';
import { getChatLogsCollectionName } from '@/utils/server/firestoreUtils';
import { getEnvName } from '@/utils/env';
import {
  getFromCache,
  setInCache,
  CACHE_EXPIRATION,
} from '@/utils/server/redisUtils';

export async function getAnswersByIds(ids: string[]): Promise<any[]> {
  const answers: any[] = [];
  const chunkSize = 10;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    try {
      const snapshot = await db
        .collection(getChatLogsCollectionName())
        .where(firebase.firestore.FieldPath.documentId(), 'in', chunk)
        .get();
      snapshot.forEach((doc) => {
        const data = doc.data();
        data.sources = parseAndRemoveWordsFromSources(data.sources);

        const relatedQuestions = data.relatedQuestionsV2 || [];

        // Suppress related_questions if it is returned from Firestore - abandoned data
        if ('related_questions' in data) {
          delete data.related_questions;
        }

        answers.push({
          id: doc.id,
          ...data,
          relatedQuestionsV2: relatedQuestions,
        });
      });
    } catch (error) {
      console.error('Error fetching chunk: ', error);
      throw error; // Rethrow the error to be caught in the handler
    }
  }

  return answers;
}

export function parseAndRemoveWordsFromSources(sources: any): any[] {
  let parsedSources: any[] = [];
  if (typeof sources === 'string') {
    try {
      const tempSources = JSON.parse(sources);
      parsedSources = Array.isArray(tempSources) ? tempSources : [];
    } catch (error) {
      console.error('Error parsing sources:', error);
    }
  } else if (Array.isArray(sources)) {
    parsedSources = sources;
  }

  return parsedSources.map(
    ({
      metadata,
      ...sourceWithoutWords
    }: {
      metadata?: any;
      [key: string]: any;
    }) => {
      if (metadata && 'full_info' in metadata) {
        delete metadata.full_info;
      }
      return { ...sourceWithoutWords, metadata };
    },
  );
}

function getCacheKeyForDocumentCount(): string {
  const envName = getEnvName();
  return `${envName}_answers_count`;
}

export async function getTotalDocuments(): Promise<number> {
  const cacheKey = getCacheKeyForDocumentCount();

  // Try to get the count from cache
  const cachedCount = await getFromCache<string>(cacheKey);
  if (cachedCount !== null) {
    return parseInt(cachedCount, 10);
  }

  // If not in cache, count the documents
  let count = 0;
  const stream = db.collection(getChatLogsCollectionName()).stream();

  for await (const _ of stream) {
    count++;
  }

  // Cache the result
  await setInCache(cacheKey, count.toString(), CACHE_EXPIRATION);

  return count;
}
