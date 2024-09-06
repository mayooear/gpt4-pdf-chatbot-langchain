import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/services/firebase';
import firebase from 'firebase-admin';
import { getAnswersCollectionName } from '@/utils/server/firestoreUtils';
import { getEnvName } from '@/utils/env';

// Create a cache object to store the fetched like statuses
const likeStatusCache: Record<string, Record<string, boolean>> = {};

const envName = getEnvName();

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
    console.log(`Likes GET: UUID: ${uuid}`);
    console.log(`Likes GET: Answer IDs: ${answerIds}`);
    const likesCollection = db.collection(`${envName}_likes`);
    const likesSnapshot = await likesCollection
      .where('uuid', '==', uuid)
      .where('answerId', 'in', answerIds)
      .get();

    // Create an object to store the like statuses
    const likeStatuses: Record<string, boolean> = {};
    likesSnapshot.forEach((doc) => {
      likeStatuses[doc.data().answerId] = true;
    });

    // Fill in false for any answerIds not found
    answerIds.forEach((id: string) => {
      if (!likeStatuses[id]) {
        likeStatuses[id] = false;
      }
    });

    res.status(200).json(likeStatuses);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Something went wrong';
    res.status(500).json({ error: errorMessage });
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
    // Create a key for the cache based on the user's UUID
    const cacheKey = `user_${uuid}`;

    // Check if the like statuses are already cached for the given user
    if (likeStatusCache[cacheKey]) {
      const cachedLikeStatuses = likeStatusCache[cacheKey];
      const filteredLikeStatuses: Record<string, boolean> = {};

      // Filter the cached like statuses based on the provided answer IDs
      answerIds.forEach((answerId) => {
        if (answerId in cachedLikeStatuses) {
          filteredLikeStatuses[answerId] = cachedLikeStatuses[answerId];
        }
      });

      // If all the requested answer IDs are found in the cache, return the filtered like statuses
      if (Object.keys(filteredLikeStatuses).length === answerIds.length) {
        return res.status(200).json(filteredLikeStatuses);
      }
    }

    const likesCollection = db.collection(`${envName}_likes`);
    const likesSnapshot = await likesCollection
      .where('uuid', '==', uuid)
      .where('answerId', 'in', answerIds)
      .get();

    // Create an object to store the like statuses
    const likeStatuses: Record<string, boolean> = {};
    likesSnapshot.forEach((doc) => {
      likeStatuses[doc.data().answerId] = true;
    });

    // Fill in false for any answerIds not found
    answerIds.forEach((id: string) => {
      if (!likeStatuses[id]) {
        likeStatuses[id] = false;
      }
    });

    // Update the cache with the fetched like statuses
    likeStatusCache[cacheKey] = {
      ...likeStatusCache[cacheKey],
      ...likeStatuses,
    };

    res.status(200).json(likeStatuses);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Something went wrong';
    res.status(500).json({ error: errorMessage });
  }
}

// fetch like counts from likes collection
async function handlePostLikeCounts(req: NextApiRequest, res: NextApiResponse) {
  let answerIds = req.body.answerIds;

  // Ensure answerIds is an array
  if (typeof answerIds === 'string') {
    answerIds = [answerIds];
  } else if (!Array.isArray(answerIds)) {
    return res.status(400).json({ error: 'Invalid answerIds format' });
  }

  try {
    const likesCollection = db.collection(`${envName}_likes`);
    const likesSnapshot = await likesCollection
      .where('answerId', 'in', answerIds)
      .get();

    // Initialize an object to store the like counts
    const likeCounts: Record<string, number> = {};

    // Aggregate the likes for each answerId
    likesSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (!likeCounts[data.answerId]) {
        likeCounts[data.answerId] = 0;
      }
      likeCounts[data.answerId] += 1;
    });

    res.status(200).json(likeCounts);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Something went wrong';
    res.status(500).json({ error: errorMessage });
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const action = req.query.action;

  // DEBUG
  // await checkLikeCountIntegrity();

  if (req.method === 'GET') {
    return handleGet(req, res);
  } else if (req.method === 'POST' && action === 'check') {
    return handlePostCheck(req, res);
  } else if (req.method === 'POST' && action === 'counts') {
    return handlePostLikeCounts(req, res);
  } else if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // add a new Like

  const { answerId, like, uuid } = req.body;
  if (!answerId || typeof like !== 'boolean' || !uuid) {
    return res
      .status(400)
      .json({ error: 'Missing answer ID, UUID or invalid like status' });
  }

  try {
    const likesCollection = db.collection(`${envName}_likes`);

    if (like) {
      // If like is true, add a new like document
      await likesCollection.add({
        uuid: uuid,
        answerId: answerId,
        timestamp: new Date(),
      });

      // Update the like count in the chat logs
      const chatLogRef = db
        .collection(getAnswersCollectionName())
        .doc(answerId);
      await chatLogRef.update({
        likeCount: firebase.firestore.FieldValue.increment(1),
      });

      // Invalidate the cache for the user
      delete likeStatusCache[`user_${uuid}`];

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

        // Update the like count in the chat logs
        const chatLogRef = db
          .collection(getAnswersCollectionName())
          .doc(answerId);
        await chatLogRef.update({
          likeCount: firebase.firestore.FieldValue.increment(-1),
        });

        // Invalidate the cache for the user
        delete likeStatusCache[`user_${uuid}`];

        res.status(200).json({ message: 'Like removed' });
      } else {
        res.status(404).json({ message: 'Like not found' });
      }
    }
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Something went wrong';
    res.status(500).json({ error: errorMessage });
  }

  // DEBUG
  // await checkLikeCountIntegrity();
}

// async function checkLikeCountIntegrity() {
//   try {
//     const chatLogsSnapshot = await db.collection(getChatLogsCollectionName()).get();
//     const likesSnapshot = await db.collection(`${envName}_likes`).get();

//     const chatLogLikeCounts: Record<string, number> = {};
//     const likeCounts: Record<string, number> = {};

//     // Collect like counts from chat logs
//     chatLogsSnapshot.forEach(doc => {
//       const data = doc.data();
//       chatLogLikeCounts[doc.id] = data.likeCount || 0;
//     });

//     // Collect like counts from likes table
//     likesSnapshot.forEach(doc => {
//       const data = doc.data();
//       const answerId = data.answerId;
//       likeCounts[answerId] = (likeCounts[answerId] || 0) + 1;
//     });

//     let discrepancyFound = false;

//     // Compare like counts
//     for (const answerId in chatLogLikeCounts) {
//       const chatLogLikeCount = chatLogLikeCounts[answerId];
//       const likeCount = likeCounts[answerId] || 0;

//       if (chatLogLikeCount !== likeCount) {
//         console.log(`ERROR: Discrepancy found for answerId ${answerId}:`);
//         console.log(`Chat log like count: ${chatLogLikeCount}`);
//         console.log(`Likes table count: ${likeCount}`);
//         discrepancyFound = true;
//       }
//     }

//     // if (!discrepancyFound) {
//     //   console.log('Like count integrity check passed. No discrepancies found.');
//     // }

//     for (const [answerId, count] of Object.entries(likeCounts)) {
//       const uuids = likesSnapshot.docs
//         .filter(doc => doc.data().answerId === answerId)
//         .map(doc => doc.data().uuid);
//       console.log(`Answer ID: ${answerId}, Like Count: ${count}, UUIDs: ${uuids.join(', ')}`);
//     }
//   } catch (error: any) {
//     console.error('Error during like count integrity check:', error);
//   }
// }
