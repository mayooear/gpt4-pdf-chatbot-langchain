import { db } from '@/services/firebase';
import type { NextApiRequest, NextApiResponse } from 'next';

const PRUNE_OLDER_THAN_DAYS = 90;
const MS_IN_A_DAY = 24 * 60 * 60 * 1000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const now = Date.now();
    const cutoffTime = now - PRUNE_OLDER_THAN_DAYS * MS_IN_A_DAY;

    const rateLimitsRef = db.collection('rateLimits');
    const oldRateLimitsQuery = rateLimitsRef.where('firstRequestTime', '<', cutoffTime);

    const oldRateLimitsSnapshot = await oldRateLimitsQuery.get();
    const batch = db.batch();

    oldRateLimitsSnapshot.forEach(doc => {
        batch.delete(doc.ref);
    });

    await batch.commit();
    res.status(200).json({ message: `Pruned ${oldRateLimitsSnapshot.size} old rate limit entries.` });
}
