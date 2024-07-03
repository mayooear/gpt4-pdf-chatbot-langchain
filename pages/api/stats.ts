import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/services/firebase';
import NodeCache from 'node-cache';
import { getChatLogsCollectionName } from '@/utils/server/firestoreUtils';

const cache = new NodeCache({ stdTTL: 300 }); // Cache for 5 minutes

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cachedStats = cache.get('stats');
  if (cachedStats) {
    return res.status(200).json(cachedStats);
  }

  try {
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    ninetyDaysAgo.setHours(0, 0, 0, 0); // Set to start of the day
    ninetyDaysAgo.setTime(ninetyDaysAgo.getTime() - (ninetyDaysAgo.getTimezoneOffset() * 60000)); // Adjust to Pacific Time

    const chatLogsRef = db.collection(getChatLogsCollectionName());
    const chatLogsSnapshot = await chatLogsRef.where('timestamp', '>=', ninetyDaysAgo).get();

    const stats = {
      questionsWithLikes: {} as Record<string, number>,
      mostPopularQuestion: {} as Record<string, { question: string; likes: number }>,
    };

    // Initialize stats for the last 90 days
    for (let i = 0; i < 90; i++) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      date.setTime(date.getTime() - (date.getTimezoneOffset() * 60000)); // Adjust to Pacific Time
      const dateString = date.toISOString().split('T')[0];
      stats.questionsWithLikes[dateString] = 0;
      stats.mostPopularQuestion[dateString] = { question: '', likes: 0 };
    }

    let totalQuestions = 0;
    chatLogsSnapshot.forEach((doc) => {
      const data = doc.data();
      const date = new Date(data.timestamp._seconds * 1000);
      date.setTime(date.getTime() - (date.getTimezoneOffset() * 60000)); // Adjust to Pacific Time
      const dateString = date.toISOString().split('T')[0];
      totalQuestions++;
      
      if (data.likeCount > 0) {
        stats.questionsWithLikes[dateString] = (stats.questionsWithLikes[dateString] || 0) + 1;
      }

      if (!stats.mostPopularQuestion[dateString] || data.likeCount > stats.mostPopularQuestion[dateString].likes) {
        stats.mostPopularQuestion[dateString] = { question: data.question, likes: data.likeCount || 0 };
      }
    });

    // Calculate percentages of questions with likes
    Object.keys(stats.questionsWithLikes).forEach((date) => {
      const questionsForDate = totalQuestions / 90; // Assuming equal distribution over 90 days
      const percentage = (stats.questionsWithLikes[date] || 0) / questionsForDate * 100;
      stats.questionsWithLikes[date] = Math.round(percentage * 10) / 10; // Round to 1 decimal place
    });

    cache.set('stats', stats);
    res.status(200).json(stats);
  } catch (error: any) {
    console.error('Error in stats handler:', error);
    res.status(500).json({ error: error.message || 'Something went wrong' });
  }
}
