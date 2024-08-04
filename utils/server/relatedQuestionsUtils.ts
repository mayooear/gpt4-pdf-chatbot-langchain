// TODO: store keywords in firestore rather than regenerating every time

import { TfIdf } from 'natural';
import rake from 'node-rake'; 
import { Redis } from '@upstash/redis';
import { db } from '@/services/firebase';
import { getChatLogsCollectionName } from '@/utils/server/firestoreUtils';
import { getEnvName, isDevelopment } from '@/utils/env';
import { getAnswersByIds, parseAndRemoveWordsFromSources } from '@/utils/server/answersUtils';
import { Answer } from '@/types/answer';

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

const CACHE_EXPIRATION = isDevelopment() ? 3600 : 86400; // 1 hour for dev, 24 hours for prod

export async function getRelatedQuestions(questionId: string): Promise<any[]> {
  console.log('getRelatedQuestions: Question ID:', questionId);
  const doc = await db.collection(getChatLogsCollectionName()).doc(questionId).get();
  if (!doc.exists) {
    throw new Error('QA document not found');
  }

  const docData = doc.data();
  if (!docData) {
    throw new Error('Document data is undefined');
  }

  const relatedQuestionIds = docData.related_questions || [];
  const relatedQuestions = await getAnswersByIds(relatedQuestionIds);
  return relatedQuestions;
}

async function getQuestionsBatch(envName: string, lastProcessedId: string | null, batchSize: number): Promise<Answer[]> {
  console.log(`Starting getQuestionsBatch with envName: ${envName}, lastProcessedId: ${lastProcessedId}, batchSize: ${batchSize}`);
  
  let query = db.collection(getChatLogsCollectionName())
                .where('question', '!=', 'private')
                .orderBy('timestamp', 'desc')
                .limit(batchSize);
  if (lastProcessedId) {
    console.log(`Last processed ID found: ${lastProcessedId}. Fetching last document...`);
    const lastDoc = await db.collection(getChatLogsCollectionName()).doc(lastProcessedId).get();
    query = query.startAfter(lastDoc);
  }
  
  const snapshot = await query.get();
  console.log(`Fetched ${snapshot.docs.length} documents from Firestore`);
  
  if (snapshot.empty) {
    console.warn('No documents found in the batch query.');
  }

  const questions: Answer[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Answer));
  console.log(`Processed ${questions.length} questions`);
  
  return questions;
}

export async function updateRelatedQuestionsBatch(batchSize: number) {
  // We may not have a full set of keywords, but by the second full pass-through,
  // we should have a pretty good set of keywords.
  const envName = getEnvName();
  const progressDocRef = db.collection('progress').doc(`${envName}_relatedQuestions`);
  const progressDoc = await progressDocRef.get();
  const lastProcessedId = progressDoc.exists ? progressDoc.data()?.lastProcessedId : null;

  let questions: Answer[] = await getQuestionsBatch(envName, lastProcessedId, batchSize);
  if (!questions.length)
  {
    // we were at the end, so start over
    console.log('updateRelatedQuestionsBatch: At the end of the collection, starting over...');
    questions = await getQuestionsBatch(envName, null, batchSize);
  }

  await extractAndStoreKeywords(questions);  
  
  let allKeywords;
  try {
    allKeywords = await fetchKeywords();
  } catch (error) {
    console.error("updateRelatedQuestionsBatch: Can't process; error fetching keywords:", error);
    return;
  }

  for (const question of questions) {
    if (!question.question) {
      console.warn(`Skipping question ID ${question.id} due to missing 'question' field`);
      continue;
    }

    let rakeKeywords;
    try {
      rakeKeywords = rake.generate(question.question);
      if (!rakeKeywords || !Array.isArray(rakeKeywords)) {
        throw new Error('Invalid keywords generated');
      }
    } catch (error) {
      console.warn(`Skipping question ID ${question.id} due to error generating keywords:`, error);
      continue;
    }

    // Use the combined keywords to find related questions
    const relatedQuestions = await findRelatedQuestionsUsingKeywords(
      rakeKeywords, 
      allKeywords, 
      0.1, 
      question.id
    );
    await db.collection(getChatLogsCollectionName()).doc(question.id).update({
      related_questions: relatedQuestions.slice(0, 5).map(q => q.id)
    });
  }

  if (questions.length > 0) {
    const lastQuestion = questions[questions.length - 1];
    await progressDocRef.set({ lastProcessedId: lastQuestion.id });
  }
}

// export async function fetchAllQuestions() {
//   const questions: { id: string, question: string }[] = [];
//   const snapshot = await db.collection(getChatLogsCollectionName())
//     .where('question', '!=', 'private')
//     .get();
//   snapshot.forEach(doc => {
//     questions.push({ id: doc.id, question: doc.data().question });
//   });
//   return questions;
// }

function removeNonAscii(text: string): string {
  return text.replace(/[^\x00-\x7F]/g, '');
}

export async function extractAndStoreKeywords(questions: { id: string, question: string }[]) {
  const tfidf = new TfIdf();
  const batch = db.batch();
  const envName = getEnvName();

  // Fetch existing cache
  const cacheKey = envName + '_keywords_cache';
  let cachedKeywords: { id: string, keywords: string[] }[] | null = await redis.get(cacheKey);
  if (!cachedKeywords) {
    cachedKeywords = [];
  }

  for (const q of questions) {
    try {
      if (!q.question || typeof q.question !== 'string') {
        throw new Error('Invalid question format');
      }
      const cleanedQuestion = removeNonAscii(q.question);
      if (!cleanedQuestion) {
        console.warn(`Skipping question ID ${q.id} after removing non-ASCII characters: ${q.question}`);
        continue;
      }
      const rakeKeywords = rake.generate(cleanedQuestion);
      tfidf.addDocument(cleanedQuestion);
      const tfidfKeywords = tfidf.listTerms(tfidf.documents.length - 1).map(term => term.term);
      const keywords = Array.from(new Set(rakeKeywords.concat(tfidfKeywords)));

      // Add keywords to Firestore
      const keywordDocRef = db.collection(`${envName}_keywords`).doc(q.id);
      batch.set(keywordDocRef, { keywords });

      // Add keywords to cache
      cachedKeywords.push({ id: q.id, keywords });
    } catch (error) {
      console.error(`Error generating keywords for question ID ${q.id} with text "${q.question}":`, error);
    }
  }

  await batch.commit();

  // Update the cache
  await redis.set(cacheKey, cachedKeywords, { ex: CACHE_EXPIRATION });
}

export async function fetchKeywords(): Promise<{ id: string, keywords: string[] }[]> {
  const envName = getEnvName();
  const cacheKey = envName + '_keywords_cache';
  const cachedKeywords: { id: string, keywords: string[] }[] | null = await redis.get(cacheKey);

  if (cachedKeywords) {
    try {
        return cachedKeywords;
    } catch (error) {
        console.error('Error parsing cached keywords:', error);
        throw error;
    }
  }

  const keywords: { id: string, keywords: string[] }[] = [];
  const snapshot = await db.collection(`${envName}_keywords`).get();
  snapshot.forEach(doc => {
    keywords.push({ id: doc.id, keywords: doc.data().keywords });
  });

  try {
    await redis.set(cacheKey, keywords, { ex: CACHE_EXPIRATION });
    console.log(`Caching ${keywords.length} keywords`);   
  } catch (error) {
    console.error('Error serializing keywords:', error);
    console.error('Keywords data:', keywords);
    throw error;
  }

  return keywords;
}

function calculateJaccardSimilarity(setA: Set<string>, setB: Set<string>) {
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

export async function updateRelatedQuestions(questionId: string) {
    // Fetch the specific question by questionId
    const questionDoc = await db.collection(getChatLogsCollectionName()).doc(questionId).get();
    if (!questionDoc.exists) {
        throw new Error('Question not found');
    }
    const newQuestion = { id: questionDoc.id, ...questionDoc.data() } as { id: string, question: string };

    let allKeywords: { id: string, keywords: string[] }[];
    try {
        allKeywords = await fetchKeywords();
    } catch (error) {
        console.error("updateRelatedQuestions: Can't process; error fetching keywords:", error);
        return;
    }

    // Extract keywords from the specific question
    const newQuestionKeywords = rake.generate(newQuestion.question);
    const combinedKeywords = allKeywords.map(k => ({
        id: k.id,
        keywords: k.id === questionId ? newQuestionKeywords : k.keywords
    }));

    // Use the combined keywords to find related questions
    const relatedQuestions = await findRelatedQuestionsUsingKeywords(newQuestionKeywords, combinedKeywords, 0.1, questionId);
    await db.collection(getChatLogsCollectionName()).doc(questionId).update({
        related_questions: relatedQuestions.slice(0, 5).map(q => q.id)
    });
}

export async function findRelatedQuestionsUsingKeywords(
    newQuestionKeywords: string[], 
    keywords: { id: string, keywords: string[] }[], 
    threshold: number, 
    questionId: string) {
  try {
    const questionKeywordsSet = new Set<string>(newQuestionKeywords);
    const relatedQuestions = keywords
      .filter(k => k.id !== questionId)
      .map(k => ({
        id: k.id,
        similarity: calculateJaccardSimilarity(questionKeywordsSet, new Set<string>(k.keywords)),
        text: k.keywords.join(' ') 
        // Using keywords to represent the question text
        // TODO: this is a bit of a hack, we should use the question text directly.
        // Should also suppress related questions with same title as target Q.
      }))
      .filter(k => k.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity);

    // Filter out duplicates, keeping only the highest-ranking one
    const uniqueRelatedQuestions = [];
    const seenTexts = new Set<string>();
    for (const question of relatedQuestions) {
      if (!seenTexts.has(question.text)) {
        uniqueRelatedQuestions.push(question);
        seenTexts.add(question.text);
      }
    }

    return uniqueRelatedQuestions;
  } catch (error) {
    console.error(`Error finding related questions for question ID: ${questionId}`, error);
    return [];
  }
}