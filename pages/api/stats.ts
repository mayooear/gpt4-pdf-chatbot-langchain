import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/services/firebase';
import NodeCache from 'node-cache';

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
    const todayString = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    threeDaysAgo.setHours(0, 0, 0, 0); // Set to start of the day
    threeDaysAgo.setTime(threeDaysAgo.getTime() - (threeDaysAgo.getTimezoneOffset() * 60000)); // Adjust to Pacific Time

    const chatLogsRef = db.collection(`${process.env.ENVIRONMENT}_chatLogs`);
    const chatLogsSnapshot = await chatLogsRef.where('timestamp', '>=', threeDaysAgo).get();

    const stats = {
      questions: {} as Record<string, number>,
      likes: {} as Record<string, number>,
      downvotes: {} as Record<string, number>,
      uniqueUsers: {} as Record<string, Set<string>>,
      questionsWithLikes: {} as Record<string, number>,
      mostPopularQuestion: {} as Record<string, { question: string; likes: number }>,
      userRetention: {} as Record<string, number>,
    };

    const userQuestionDates = new Map<string, Set<string>>();

    // Initialize stats for the last 4 days (including today)
    for (let i = 0; i < 4; i++) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      date.setTime(date.getTime() - (date.getTimezoneOffset() * 60000)); // Adjust to Pacific Time
      const dateString = date.toISOString().split('T')[0];
      stats.questions[dateString] = 0;
      stats.likes[dateString] = 0;
      stats.downvotes[dateString] = 0;
      stats.uniqueUsers[dateString] = new Set();
      stats.questionsWithLikes[dateString] = 0;
      stats.mostPopularQuestion[dateString] = { question: '', likes: 0 };
    }

    chatLogsSnapshot.forEach((doc) => {
      const data = doc.data();
      const date = new Date(data.timestamp._seconds * 1000);
      date.setTime(date.getTime() - (date.getTimezoneOffset() * 60000)); // Adjust to Pacific Time
      const dateString = date.toISOString().split('T')[0];
      stats.questions[dateString] = (stats.questions[dateString] || 0) + 1;
      stats.likes[dateString] = (stats.likes[dateString] || 0) + (data.likeCount || 0);
      stats.downvotes[dateString] = (stats.downvotes[dateString] || 0) + (data.vote === -1 ? 1 : 0);
      
      if (!stats.uniqueUsers[dateString]) stats.uniqueUsers[dateString] = new Set();
      stats.uniqueUsers[dateString].add(data.ip);

      if (data.likeCount > 0) {
        stats.questionsWithLikes[dateString] = (stats.questionsWithLikes[dateString] || 0) + 1;
      }

      if (!stats.mostPopularQuestion[dateString] || data.likeCount > stats.mostPopularQuestion[dateString].likes) {
        stats.mostPopularQuestion[dateString] = { question: data.question, likes: data.likeCount || 0 };
      }

      if (!userQuestionDates.has(data.ip)) {
        userQuestionDates.set(data.ip, new Set());
      }
      userQuestionDates.get(data.ip)!.add(dateString);
    });

    // Calculate user retention
    const dates = Object.keys(stats.questions).sort();
    for (let i = 1; i < dates.length; i++) {
      const prevDate = dates[i - 1];
      const currDate = dates[i];
      let retainedUsers = 0;
      userQuestionDates.forEach((dates) => {
        if (dates.has(prevDate) && dates.has(currDate)) {
          retainedUsers++;
        }
      });
      stats.userRetention[currDate] = retainedUsers;
    }

    // Convert Sets to numbers for JSON serialization
    Object.keys(stats.uniqueUsers).forEach((date) => {
      stats.uniqueUsers[date] = stats.uniqueUsers[date].size as any;
    });

    // Calculate percentages of questions with likes
    Object.keys(stats.questions).forEach((date) => {
      const percentage = (stats.questionsWithLikes[date] || 0) / stats.questions[date] * 100;
      stats.questionsWithLikes[date] = Math.round(percentage * 10) / 10; // Round to 1 decimal place
    });

    cache.set('stats', stats);
    res.status(200).json(stats);
  } catch (error: any) {
    console.error('Error in stats handler:', error);
    res.status(500).json({ error: error.message || 'Something went wrong' });
  }
}
