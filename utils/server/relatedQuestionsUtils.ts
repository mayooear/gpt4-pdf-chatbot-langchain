// TODO: store keywords in firestore rather than regenerating every time

import { db } from '@/services/firebase';
import { getEnvName } from '@/utils/env';
import { TfIdf } from 'natural';
import rake from 'node-rake'; 

async function fetchQuestions(envName: string) {
  const questions: { id: string, question: string }[] = [];
  const snapshot = await db.collection(`${envName}_chatLogs`).get();
  snapshot.forEach(doc => {
    questions.push({ id: doc.id, question: doc.data().question });
  });
  return questions;
}

function removeNonAscii(text: string): string {
  return text.replace(/[^\x00-\x7F]/g, '');
}

function extractKeywords(questions: { id: string, question: string }[]) {
  const tfidf = new TfIdf();
  const keywords = questions.map(q => {
    try {
      if (!q.question || typeof q.question !== 'string') {
        throw new Error('Invalid question format');
      }
      const cleanedQuestion = removeNonAscii(q.question);
      if (!cleanedQuestion) {
        console.warn(`Skipping question ID ${q.id} after removing non-ASCII characters: ${q.question}`);
        return {
          id: q.id,
          keywords: []
        };
      }
      const rakeKeywords = rake.generate(cleanedQuestion);
      tfidf.addDocument(cleanedQuestion); // Add document to tfidf
      const tfidfKeywords = tfidf.listTerms(tfidf.documents.length - 1).map(term => term.term);
      return {
        id: q.id,
        keywords: Array.from(new Set(rakeKeywords.concat(tfidfKeywords))) // Ensure unique keywords
      };
    } catch (error) {
      console.error(`Error generating keywords for question ID ${q.id} with text "${q.question}":`, error);
      return {
        id: q.id,
        keywords: []
      };
    }
  });
  return keywords;
}

function calculateJaccardSimilarity(setA: Set<string>, setB: Set<string>) {
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

async function findRelatedQuestions(question: string, questions: { id: string, question: string }[], keywords: { id: string, keywords: string[] }[], threshold: number, questionId: string) {
  try {
    if (!question || typeof question !== 'string') {
      throw new Error('Invalid question format');
    }
    const cleanedQuestion = removeNonAscii(question);
    if (!cleanedQuestion) {
      console.warn(`Skipping question after removing non-ASCII characters: ${question}`);
      return [];
    }
    const questionKeywords = new Set<string>(rake.generate(cleanedQuestion));
    const relatedQuestions = questions
      .filter(q => q.id !== questionId)
      .map(q => ({
        id: q.id,
        question: q.question, 
        similarity: calculateJaccardSimilarity(questionKeywords, new Set<string>(keywords.find(k => k.id === q.id)?.keywords || []))
      }))
      .filter(q => q.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity);

    // Ensure unique related questions, keeping only the highest similarity score
    const uniqueRelatedQuestions = new Map<string, { id: string, similarity: number }>();
    for (const q of relatedQuestions) {
      if (!uniqueRelatedQuestions.has(q.question) || uniqueRelatedQuestions.get(q.question)!.similarity < q.similarity) {
        uniqueRelatedQuestions.set(q.question, { id: q.id, similarity: q.similarity });
      }
    }

    return Array.from(uniqueRelatedQuestions.values());
  } catch (error) {
    console.error(`Error finding related questions for question: ${question}`, error);
    return [];
  }
}

export async function updateRelatedQuestions(envName: string, questionId?: string) {
  const questions = await fetchQuestions(envName);
  const allKeywords = extractKeywords(questions);

  if (questionId) {
    const newQuestion = questions.find(q => q.id === questionId);
    if (!newQuestion) {
      throw new Error('Question not found');
    }
    const combinedQuestions = questions.filter(q => q.id !== questionId);
    const combinedKeywords = allKeywords.filter(k => k.id !== questionId);
    const relatedQuestions = await findRelatedQuestions(newQuestion.question, combinedQuestions, combinedKeywords, 0.1, questionId);
    await db.collection(`${envName}_chatLogs`).doc(questionId).update({
      related_questions: relatedQuestions.slice(0, 5).map(q => q.id)
    });
  } else {
    for (const question of questions) {
      const relatedQuestions = await findRelatedQuestions(question.question, questions, allKeywords, 0.1, question.id);
      await db.collection(`${envName}_chatLogs`).doc(question.id).update({
        related_questions: relatedQuestions.slice(0, 5).map(q => q.id)
      });
    }
  }
}