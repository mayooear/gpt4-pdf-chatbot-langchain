import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from './chat';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { docId, vote } = req.body;

  if (!docId || (vote !== 1 && vote !== 0 && vote !== -1)) {
    return res.status(400).json({ error: 'Missing document ID or invalid vote' });
  }

  try {
    const docRef = db.collection(`${process.env.ENVIRONMENT}_chatLogs`).doc(docId);
    // Set the vote to 1 for upvote or -1 for downvote
    await docRef.update({ vote });
    res.status(200).json({ message: 'Vote recorded' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Something went wrong' });
  }
}
