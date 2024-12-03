import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/services/firebase';
import { genericRateLimiter } from '@/utils/server/genericRateLimiter';
import { withApiMiddleware } from '@/utils/server/apiMiddleware';
import { isDevelopment } from '@/utils/env';

interface ComparisonVote {
  userId: string;
  timestamp: Date;
  winner: 'A' | 'B' | 'skip';
  modelAConfig: {
    model: string;
    temperature: number;
    response: string;
  };
  modelBConfig: {
    model: string;
    temperature: number;
    response: string;
  };
  question: string;
  reasons?: {
    moreAccurate: boolean;
    betterWritten: boolean;
    moreHelpful: boolean;
    betterReasoning: boolean;
    betterSourceUse: boolean;
  };
  userComments?: string;
  collection: string;
  mediaTypes: {
    text: boolean;
    audio: boolean;
    youtube: boolean;
  };
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const isAllowed = await genericRateLimiter(req, res, {
    windowMs: 60 * 1000, // 1 minute
    max: 5, // 5 votes per minute
    name: 'model_comparison_vote',
  });

  if (!isAllowed) {
    return; // Rate limiter already sent the response
  }

  const voteData: ComparisonVote = req.body;

  // Validate required fields
  if (
    !voteData.userId ||
    !voteData.modelAConfig ||
    !voteData.modelBConfig ||
    !voteData.question
  ) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const prefix = isDevelopment() ? 'dev_' : 'prod_';
    const voteRef = db.collection(`${prefix}model_comparison_votes`);

    await voteRef.add({
      ...voteData,
      timestamp: new Date(),
      // Only include reasons and comments if it's not a skip
      ...(voteData.winner !== 'skip' && {
        reasons: voteData.reasons,
        userComments: voteData.userComments,
      }),
    });

    res.status(200).json({ message: 'Vote recorded successfully' });
  } catch (error) {
    console.error('Error recording vote:', error);
    res.status(500).json({ error: 'Failed to record vote' });
  }
}

export default withApiMiddleware(handler);
