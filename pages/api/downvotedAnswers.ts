import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/services/firebase';
import { getSudoCookie } from '@/utils/server/sudoCookieUtils';
import { getAnswersCollectionName } from '@/utils/server/firestoreUtils';
import { withApiMiddleware } from '@/utils/server/apiMiddleware';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sudo = getSudoCookie(req, res);
  if (!sudo.sudoCookieValue) {
    return res.status(403).json({ message: `Forbidden: ${sudo.message}` });
  }

  try {
    const answersRef = db.collection(getAnswersCollectionName());
    const downvotedAnswersSnapshot = await answersRef
      .where('vote', '==', -1)
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();

    const downvotedAnswers = downvotedAnswersSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        text: data.text || '',
        vote: data.vote || 0,
        timestamp: data.timestamp?.toDate?.() || null,
      };
    });

    return res.status(200).json(downvotedAnswers);
  } catch (error) {
    console.error('Error fetching downvoted answers:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Something went wrong',
    });
  }
}

export default withApiMiddleware(handler);
