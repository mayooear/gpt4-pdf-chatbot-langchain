import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/services/firebase';
import firebase from 'firebase-admin';

async function getAnswersByIds(ids: string[]): Promise<any[]> {
  const answers: any[] = [];
  const chunkSize = 10;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    try {
      const snapshot = await db.collection(`${process.env.ENVIRONMENT}_chatLogs`)
                               .where(firebase.firestore.FieldPath.documentId(), 'in', chunk)
                               .get();
      snapshot.forEach(doc => {
        const data = doc.data();
        try {
          if (typeof data.sources === 'string') {
            const sanitizedSources = data.sources.replace(/[\x00-\x1F\x7F-\x9F]/g, "");
            data.sources = JSON.parse(sanitizedSources);
          } else {
            data.sources =  [];
          }
        } catch (error) {
          data.sources = []
        }
        answers.push({ id: doc.id, ...data });
      });
    } catch (error) {
      console.error('Error fetching chunk: ', error);
      throw error; // Rethrow the error to be caught in the handler
    }
  }
  return answers;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === 'GET') {
    try {
      const { answerIds } = req.query;
      if (!answerIds || typeof answerIds !== 'string') {
        return res.status(400).json({ message: 'answerIds parameter is required and must be a comma-separated string.' });
      }
      const idsArray = answerIds.split(',');
      const answers = await getAnswersByIds(idsArray);
      res.status(200).json(answers);
    } catch (error: any) {
      console.error('Error fetching answers: ', error);
      if (error.code === 8) { 
        res.status(429).json({ message: 'Error: Quota exceeded. Please try again later.' });
      } else {
        res.status(500).json({ message: 'Error fetching answers', error: error.message });
      }
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
