import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from './chat'; // Import db from chat.ts

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
    if (req.method === 'GET') {
        try {
          // Fetch all shares from the Firestore collection
          const sharesSnapshot = await db.collection(`${process.env.ENVIRONMENT}_shares`).orderBy('createdAt', 'desc').get();
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
        const { firstName, lastName, comments, answerId } = req.body;

        // Validate the input
        if (!firstName || !lastName || !answerId) {
        res.status(400).json({ message: 'Missing required fields' });
        return;
        }

        try {
        // Add a new document with a generated id to the "shares" collection
        const docRef = await db.collection(`${process.env.ENVIRONMENT}_shares`).add({
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