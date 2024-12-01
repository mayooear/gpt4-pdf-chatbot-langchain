import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/services/firebase';
import { genericRateLimiter } from '@/utils/server/genericRateLimiter';
import { withApiMiddleware } from '@/utils/server/apiMiddleware';
import { isDevelopment } from '@/utils/env';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const isAllowed = await genericRateLimiter(req, res, {
    windowMs: 60 * 1000, // 1 minute
    max: 3, // 3 votes per minute
    name: 'model_comparison_vote',
  });

  if (!isAllowed) {
    return; // Rate limiter already sent the response
  }

  const {
    userId,
    winner,
    modelAConfig,
    modelBConfig,
    question,
    reasons,
    userComments,
    collection,
    mediaTypes,
  } = req.body;

  // Validate required fields
  if (!userId || !winner || !modelAConfig || !modelBConfig || !question) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const prefix = isDevelopment() ? 'dev_' : 'prod_';
    console.log('Starting vote recording...');
    console.log('Collection name:', `${prefix}model_comparison_votes`);
    console.log('Vote data:', {
      userId,
      timestamp: new Date(),
      winner,
      modelAConfig,
      modelBConfig,
      question,
      reasons,
      userComments,
      collection,
      mediaTypes,
    });

    const voteRef = db.collection(`${prefix}model_comparison_votes`);
    const docRef = await voteRef.add({
      userId,
      timestamp: new Date(),
      winner,
      modelAConfig,
      modelBConfig,
      question,
      reasons,
      userComments,
      collection,
      mediaTypes,
    });
    console.log('Vote recorded successfully with ID:', docRef.id);
    console.log('Full path:', `${prefix}model_comparison_votes/${docRef.id}`);

    // Verify the document was written
    const docSnapshot = await docRef.get();
    console.log('Document exists:', docSnapshot.exists);
    console.log('Document data:', docSnapshot.data());

    res.status(200).json({ message: 'Vote recorded successfully' });
  } catch (error) {
    console.error('Error recording vote:', error);
    res.status(500).json({ error: 'Failed to record vote' });
  }
}

export default withApiMiddleware(handler);
