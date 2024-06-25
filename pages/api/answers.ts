import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/services/firebase';
import firebase from 'firebase-admin';
import { getSudoCookie } from '@/utils/server/sudoCookieUtils';

// 6/23/24: likedOnly filtering not being used in UI but leaving here for potential future use
async function getAnswers(page: number, limit: number, likedOnly: boolean, sortBy: string): Promise<any[]> {
  let answersQuery = db.collection(`${process.env.ENVIRONMENT}_chatLogs`)
    .where('question', '!=', 'private')
    .orderBy(sortBy === 'mostPopular' ? 'likeCount' : 'timestamp', 'desc');

  if (sortBy === 'mostPopular') {
    answersQuery = answersQuery.orderBy('timestamp', 'desc');
  }

  answersQuery = answersQuery
    .offset(page * limit)
    .limit(limit);

  if (likedOnly) {
    answersQuery = answersQuery.where('likeCount', '>', 0);
  }

  // console.log(`Executing query with page: ${page}, limit: ${limit}, sortBy: ${sortBy}`);
  const answersSnapshot = await answersQuery.get();
  // console.log(`\nQuery returned ${answersSnapshot.size} documents for page: ${page}, limit: ${limit}`);

  const answers = answersSnapshot.docs.map((doc, index) => {
    const data = doc.data();
    let sources: Document[] = [];
    try {
      sources = data.sources ? JSON.parse(data.sources) as Document[]: [];
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
    // console.log(`${index + 1}. ${data.question}`);
    return {
      id: doc.id,
      ...data,
      sources,
      likeCount: data.likeCount || 0,
    };
  });

  return answers;
}

async function getAnswersByIds(ids: string[]): Promise<any[]> {
  const answers: any[] = [];
  const chunkSize = 10;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    try {
      const snapshot = await db.collection(`${process.env.ENVIRONMENT}_chatLogs`)
                               .where(firebase.firestore.FieldPath.documentId(), 'in', chunk)
                               .get();
      snapshot.forEach(doc => {
        const data = doc.data();
        try {
          if (typeof data.sources === 'string') {
            const sanitizedSources = data.sources.replace(/[\x00-\x1F\x7F-\x9F]/g, "");
            data.sources = JSON.parse(sanitizedSources);
          } else {
            data.sources =  [];
          }
        } catch (error) {
          data.sources = []
        }
        answers.push({ id: doc.id, ...data });
      });
    } catch (error) {
      console.error('Error fetching chunk: ', error);
      throw error; // Rethrow the error to be caught in the handler
    }
  }
  return answers;
}

async function deleteAnswerById(id: string): Promise<void> {
  try {
    await db.collection(`${process.env.ENVIRONMENT}_chatLogs`).doc(id).delete();
  } catch (error) {
    console.error('Error deleting answer: ', error);
    throw error;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === 'GET') {
    try {
      const { answerIds } = req.query;

      if (answerIds) {
        if (typeof answerIds !== 'string') {
          return res.status(400).json({ message: 'answerIds parameter must be a comma-separated string.' });
        }
        const idsArray = answerIds.split(',');
        const answers = await getAnswersByIds(idsArray);
        res.status(200).json(answers);
      } else {
        const { page, limit, likedOnly, sortBy } = req.query;
        const pageNumber = parseInt(page as string) || 0;
        const limitNumber = parseInt(limit as string) || 10;
        const likedOnlyFlag = likedOnly === 'true';
        const sortByValue = sortBy as string || 'mostRecent'; 
        const answers = await getAnswers(pageNumber, limitNumber, likedOnlyFlag, sortByValue); 
        res.status(200).json(answers);
      }
    } catch (error: any) {
      console.error('Error fetching answers: ', error);
      if (error.code === 8) { 
        res.status(429).json({ message: 'Error: Quota exceeded. Please try again later.' });
      } else {
        res.status(500).json({ message: 'Error fetching answers', error: error.message });
      }
    }
  } else if (req.method === 'DELETE') {
    try {
      const { answerId } = req.query;
      if (!answerId || typeof answerId !== 'string') {
        return res.status(400).json({ message: 'answerId parameter is required.' });
      }
      const sudo = getSudoCookie(req, res);
      if (!sudo.sudoCookieValue) {
        return res.status(403).json({ message: 'Forbidden: Insufficient permissions.' });
      }
      await deleteAnswerById(answerId);
      res.status(200).json({ message: 'Answer deleted successfully.' });
    } catch (error: any) {
      console.error('Handler: Error deleting answer: ', error);
      res.status(500).json({ message: 'Error deleting answer', error: error.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
