import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/services/firebase';
import firebase from 'firebase-admin';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

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

    chatLogsSnapshot.forEach((doc) => {
      const data = doc.data();
      const date = new Date(data.timestamp._seconds * 1000).toISOString().split('T')[0];
      
      stats.questions[date] = (stats.questions[date] || 0) + 1;
      stats.likes[date] = (stats.likes[date] || 0) + (data.likeCount || 0);
      stats.downvotes[date] = (stats.downvotes[date] || 0) + (data.vote === -1 ? 1 : 0);
      
      if (!stats.uniqueUsers[date]) stats.uniqueUsers[date] = new Set();
      stats.uniqueUsers[date].add(data.ip);

      if (data.likeCount > 0) {
        stats.questionsWithLikes[date] = (stats.questionsWithLikes[date] || 0) + 1;
      }

      if (!stats.mostPopularQuestion[date] || data.likeCount > stats.mostPopularQuestion[date].likes) {
        stats.mostPopularQuestion[date] = { question: data.question, likes: data.likeCount || 0 };
      }

      if (!userQuestionDates.has(data.ip)) {
        userQuestionDates.set(data.ip, new Set());
      }
      userQuestionDates.get(data.ip)!.add(date);
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

    res.status(200).json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Something went wrong' });
  }
}
