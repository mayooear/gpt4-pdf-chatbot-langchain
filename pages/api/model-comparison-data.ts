import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/services/firebase';
import { withApiMiddleware } from '@/utils/server/apiMiddleware';
import { isDevelopment } from '@/utils/env';
import { getSudoCookie } from '@/utils/server/sudoCookieUtils';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check sudo cookie authentication
  const sudoStatus = getSudoCookie(req, res);
  if (!sudoStatus.sudoCookieValue) {
    return res
      .status(403)
      .json({ error: 'Unauthorized: Sudo access required' });
  }

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const offset = (page - 1) * limit;

  try {
    const prefix = isDevelopment() ? 'dev_' : 'prod_';
    const collectionRef = db.collection(`${prefix}model_comparison_votes`);

    // Get total count
    const snapshot = await collectionRef.count().get();
    const total = snapshot.data().count;

    // Get paginated data
    const querySnapshot = await collectionRef
      .orderBy('timestamp', 'desc')
      .offset(offset)
      .limit(limit)
      .get();

    const comparisons = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp.toDate().toISOString(),
    }));

    res.status(200).json({
      comparisons,
      total,
      page,
      limit,
    });
  } catch (error) {
    console.error('Error fetching model comparisons:', error);
    res.status(500).json({ error: 'Failed to fetch model comparisons' });
  }
}

export default withApiMiddleware(handler);
