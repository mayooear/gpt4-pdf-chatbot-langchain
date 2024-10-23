// This file contains utility functions for handling answers and related operations

import { db } from '@/services/firebase';
import firebase from 'firebase-admin';
import { getAnswersCollectionName } from '@/utils/server/firestoreUtils';
import { getEnvName } from '@/utils/env';
import {
  getFromCache,
  setInCache,
  CACHE_EXPIRATION,
} from '@/utils/server/redisUtils';
import { Answer } from '@/types/answer';
import { Document } from 'langchain/document';
import { DocMetadata } from '@/types/DocMetadata';

// Fetches answers from Firestore based on an array of IDs
// Uses batching to optimize database queries
export async function getAnswersByIds(ids: string[]): Promise<Answer[]> {
  const answers: Answer[] = [];
  const chunkSize = 10; // Process IDs in batches of 10
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    try {
      const snapshot = await db
        .collection(getAnswersCollectionName())
        .where(firebase.firestore.FieldPath.documentId(), 'in', chunk)
        .get();
      snapshot.forEach((doc) => {
        const data = doc.data() as Omit<Answer, 'id'>;
        // Parse and clean up sources data
        data.sources = parseAndRemoveWordsFromSources(
          data.sources as string | Document<DocMetadata>[] | undefined,
        );

        const relatedQuestions = data.relatedQuestionsV2 || [];

        // Remove deprecated 'related_questions' field if present
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

// Parses and cleans up the sources data, removing unnecessary information
export function parseAndRemoveWordsFromSources(
  sources: string | Document<DocMetadata>[] | undefined,
): Document<DocMetadata>[] {
  if (!sources) {
    return [];
  }

  let parsedSources: Document<DocMetadata>[] = [];
  if (typeof sources === 'string') {
    try {
      const tempSources = JSON.parse(sources);
      parsedSources = Array.isArray(tempSources) ? tempSources : [];
    } catch (error) {
      console.error(
        'parseAndRemoveWordsFromSources: Error parsing sources:',
        error,
      );
    }
  } else if (Array.isArray(sources)) {
    parsedSources = sources;
  }

  // Remove 'full_info' from metadata and return cleaned up sources
  return parsedSources.map(({ pageContent, metadata }) => {
    const cleanedMetadata = { ...metadata };
    if (cleanedMetadata && 'full_info' in cleanedMetadata) {
      delete cleanedMetadata.full_info;
    }
    return {
      pageContent,
      metadata: cleanedMetadata as DocMetadata,
    };
  });
}

// Generates a unique cache key for document count based on environment and site ID
function getCacheKeyForDocumentCount(): string {
  const envName = getEnvName();
  const siteId = process.env.SITE_ID || 'default';
  return `${envName}_${siteId}_answers_count`;
}

// Retrieves the total number of documents in the answers collection
// Uses caching to improve performance for repeated calls
export async function getTotalDocuments(): Promise<number> {
  const cacheKey = getCacheKeyForDocumentCount();

  // Try to get the count from cache
  const cachedCount = await getFromCache<string>(cacheKey);
  if (cachedCount !== null) {
    return parseInt(cachedCount, 10);
  }

  // If not in cache, count the documents
  let count = 0;
  const stream = db.collection(getAnswersCollectionName()).stream();

  // Count documents using a stream to handle large collections efficiently
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for await (const _ of stream) {
    count++;
  }

  // Cache the result for future use
  await setInCache(cacheKey, count.toString(), CACHE_EXPIRATION);

  return count;
}
