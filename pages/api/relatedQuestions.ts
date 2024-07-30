import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/services/firebase';
import { getAnswersByIds, parseAndRemoveWordsFromSources } from '@/utils/server/answersUtils';
import { getEnvName } from '@/utils/env';

async function getRelatedQuestions(questionId: string): Promise<any[]> {
  const envName = getEnvName();
  console.log('getRelatedQuestions: Question ID:', questionId);
  const doc = await db.collection(`${envName}_chatLogs`).doc(questionId).get();
  if (!doc.exists) {
    throw new Error('QA document not found');
  }

  const docData = doc.data();
  if (!docData) {
    throw new Error('Document data is undefined');
  }

  const sources = parseAndRemoveWordsFromSources(docData.sources);

  console.log('Doc:', {
    ...docData,
    sources: sources // Log all sources
  });

  // Add debug log for related_questions field
  console.log('Related questions field:', docData.related_questions);

  console.log('Has related questions:', !!docData.related_questions?.length);
  const relatedQuestionIds = docData.related_questions || [];
  console.log('Related question IDs:', relatedQuestionIds);
  const relatedQuestions = await getAnswersByIds(relatedQuestionIds);
  console.log('Fetched related questions:', relatedQuestions);
  return relatedQuestions;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === 'GET') {
    try {
      const { questionId } = req.query;

      if (!questionId || typeof questionId !== 'string') {
        return res.status(400).json({ message: 'questionId parameter is required and must be a string.' });
      }

      const relatedQuestions = await getRelatedQuestions(questionId);
      res.status(200).json(relatedQuestions);

    } catch (error: any) {
      console.error('Error fetching related questions: ', error);
      res.status(500).json({ message: 'Error fetching related questions', error: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}