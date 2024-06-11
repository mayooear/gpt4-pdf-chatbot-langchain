import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/services/firebase';
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 100, checkperiod: 120 }); // TTL in seconds

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'GET') {
    const page = parseInt(req.query.page as string) || 0;
    const limit = parseInt(req.query.limit as string) || 10;
    const cacheKey = `logs-${page}-${limit}`;

    // Try fetching from cache first
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }

    try {
      const answersQuery = db.collection(`${process.env.ENVIRONMENT}_chatLogs`)
        .where('question', '!=', 'private')
        .orderBy('timestamp', 'desc')
        .offset(page * limit)
        .limit(limit);

      const answersSnapshot = await answersQuery.get();
      const answers = answersSnapshot.docs.map(doc => {
        const data = doc.data();
        let sources = [];
        try {
          sources = data.sources ? JSON.parse(data.sources) : [];
        } catch (e) {
          // Very early sources were stored in non-JSON so recognize those and only log an error for other cases
          if (!data.sources.trim().substring(0, 50).includes("Sources:")) {
            console.error('Error parsing sources:', e);
            console.log("data.sources: '" + data.sources + "'");
            if (!data.sources || data.sources.length === 0) {
              console.log("data.sources is empty or null");
            }
          }
        }
        return {
          id: doc.id,
          ...data,
          sources,
        };
      });

      // Cache the fetched data
      cache.set(cacheKey, answers);

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
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
