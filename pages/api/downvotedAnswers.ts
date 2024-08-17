import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/services/firebase';
import { getSudoCookie } from '@/utils/server/sudoCookieUtils';
import { getChatLogsCollectionName } from '@/utils/server/firestoreUtils';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sudo = getSudoCookie(req, res);
  if (!sudo.sudoCookieValue) {
    return res.status(403).json({ message: `Forbidden: ${sudo.message}` });
  }

  try {
    const chatLogsRef = db.collection(getChatLogsCollectionName());
    const downvotedAnswersSnapshot = await chatLogsRef
      .where('vote', '==', -1)
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();

    const downvotedAnswers = downvotedAnswersSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.status(200).json(downvotedAnswers);
  } catch (error: any) {
    console.error('Error fetching downvoted answers:', error);
    res.status(500).json({ error: error.message || 'Something went wrong' });
  }
}
