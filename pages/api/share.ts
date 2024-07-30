import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/services/firebase';
import { getEnvName } from '@/utils/env';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
    const envName = getEnvName();

    if (req.method === 'GET') {
      // Fetch shares with pagination and reverse chronological order
      const page = parseInt(req.query.page as string) || 0;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = page * limit;

      try {
        const startTime = performance.now(); // Start timing before the query

        const sharesQuery = db.collection(`${envName}_shares`)
          .orderBy('createdAt', 'desc')
          .offset(offset)
          .limit(limit);

        const sharesSnapshot = await sharesQuery.get();

        const endTime = performance.now(); // End timing after the query
        const duration = Math.round(endTime - startTime);
        console.log(`Share: call to Firestore took ${duration} milliseconds.`);

        const shares = sharesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));

        res.status(200).json(shares);

      } catch (error) {
        console.error('Error fetching shares: ', error);
        res.status(500).json({ message: 'Error fetching shares', error });
      }
    } else if (req.method === 'POST') {
      // add a new share
      const { firstName, lastName, comments, answerId } = req.body;

      // Validate the input
      if (!firstName || !lastName || !answerId) {
      res.status(400).json({ message: 'Missing required fields' });
      return;
      }

      try {
      // Add a new document with a generated id to the "shares" collection
      const docRef = await db.collection(`${envName}_shares`).add({
          firstName,
          lastName,
          comments,
          answerId,
          createdAt: new Date(),
      });

      res.status(200).json({ message: 'Share submitted successfully', id: docRef.id });
      } catch (error) {
      console.error('Error writing document: ', error);
      res.status(500).json({ message: 'Error storing submission', error });
      }
    } else {
      // Handle any other HTTP methods
      res.setHeader('Allow', ['POST', 'GET']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}