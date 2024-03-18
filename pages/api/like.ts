import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/services/firebase'; 

// New handler for GET request to check like statuses
async function handleGet(req: NextApiRequest, res: NextApiResponse) {
    let answerIds = req.query.answerIds;
    const { uuid } = req.query;
  
    // Ensure answerIds is an array
    if (typeof answerIds === 'string') {
        answerIds = [answerIds];
    } else if (!Array.isArray(answerIds)) {
        return res.status(400).json({ error: 'Invalid answerIds format' });
    }

    // Validate the input
    if (!answerIds || !uuid) {
      return res.status(400).json({ error: 'Missing answer IDs or UUID' });
    }
  
    try {
      const likesCollection = db.collection(`${process.env.ENVIRONMENT}_likes`);
      const likesSnapshot = await likesCollection
        .where('uuid', '==', uuid)
        .where('answerId', 'in', answerIds)
        .get();
  
      // Create an object to store the like statuses
      const likeStatuses: Record<string, boolean> = {};
      likesSnapshot.forEach(doc => {
        likeStatuses[doc.data().answerId] = true;
      });
  
      // Fill in false for any answerIds not found
      answerIds.forEach((id: string) => {
        if (!likeStatuses[id]) {
          likeStatuses[id] = false;
        }
      });
  
      res.status(200).json(likeStatuses);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Something went wrong' });
    }
}

// New handler for POST request to check like statuses
async function handlePostCheck(req: NextApiRequest, res: NextApiResponse) {
    const { answerIds, uuid } = req.body;

    // Validate the input
    if (!Array.isArray(answerIds) || !uuid) {
        return res.status(400).json({ error: 'Invalid request body' });
    }

    try {
        const likesCollection = db.collection(`${process.env.ENVIRONMENT}_likes`);
        const likesSnapshot = await likesCollection
            .where('uuid', '==', uuid)
            .where('answerId', 'in', answerIds)
            .get();

        // Create an object to store the like statuses
        const likeStatuses: Record<string, boolean> = {};
        likesSnapshot.forEach(doc => {
            likeStatuses[doc.data().answerId] = true;
        });

        // Fill in false for any answerIds not found
        answerIds.forEach((id: string) => {
            if (!likeStatuses[id]) {
                likeStatuses[id] = false;
            }
        });

        res.status(200).json(likeStatuses);
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Something went wrong' });
    }
}

// fetch like counts
async function handlePostLikeCounts(req: NextApiRequest, res: NextApiResponse) {
    let answerIds = req.body.answerIds;

    // Ensure answerIds is an array
    if (typeof answerIds === 'string') {
        answerIds = [answerIds];
    } else if (!Array.isArray(answerIds)) {
        return res.status(400).json({ error: 'Invalid answerIds format' });
    }

    try {
      const likesCollection = db.collection(`${process.env.ENVIRONMENT}_likes`);
      const likesSnapshot = await likesCollection
        .where('answerId', 'in', answerIds)
        .get();
  
      // Initialize an object to store the like counts
      const likeCounts: Record<string, number> = {};

      // Aggregate the likes for each answerId
      likesSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (!likeCounts[data.answerId]) {
              likeCounts[data.answerId] = 0;
          }
          likeCounts[data.answerId] += 1; 
      });

      res.status(200).json(likeCounts);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Something went wrong' });
    }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const action = req.query.action;

  if (req.method === 'GET') {
    return handleGet(req, res);
  } else if (req.method === 'POST' && action === 'check') {
    return handlePostCheck(req, res);
  } else if (req.method === 'POST' && action === 'counts') {
    return handlePostLikeCounts(req, res);
  } else if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { answerId, like, uuid } = req.body;
  if (!answerId || typeof like !== 'boolean' || !uuid) {
    return res.status(400).json({ error: 'Missing answer ID, UUID or invalid like status' });
  }

  try {
    // Reference to the likes collection
    const likesCollection = db.collection(`${process.env.ENVIRONMENT}_likes`);

    if (like) {
      // If like is true, add a new like document
      await likesCollection.add({
        uuid: uuid,
        answerId: answerId,
        timestamp: new Date() // Store the timestamp of the like
      });
      res.status(200).json({ message: 'Like added' });
    } else {
      // If like is false, find the like document and remove it
      const querySnapshot = await likesCollection
        .where('uuid', '==', uuid)
        .where('answerId', '==', answerId)
        .limit(1)
        .get();

      if (!querySnapshot.empty) {
        // Assuming there's only one like per user per answer
        const docRef = querySnapshot.docs[0].ref;
        await docRef.delete();
        res.status(200).json({ message: 'Like removed' });
      } else {
        res.status(404).json({ message: 'Like not found' });
      }
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Something went wrong' });
  }
}