import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/services/firebase';
import firebase from 'firebase-admin';

async function getAnswersByIds(ids: string[]): Promise<any[]> {
  const answers: any[] = [];
  const chunkSize = 10;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
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
    } catch (error) {
      console.error('Error fetching answers: ', error);
      res.status(500).json({ message: 'Error fetching answers', error });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
