import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/services/firebase';
import firebase from 'firebase-admin';
import { getSudoCookie } from '@/utils/server/sudoCookieUtils';
import { getAnswersCollectionName } from '@/utils/server/firestoreUtils';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sudo = getSudoCookie(req, res);
  if (!sudo.sudoCookieValue) {
    return res.status(403).json({ message: `Forbidden: ${sudo.message}` });
  }

  const { docId, action } = req.body;

  if (!docId) {
    return res.status(400).json({ error: 'Missing document ID' });
  }

  try {
    const docRef = db.collection(getAnswersCollectionName()).doc(docId);
    if (action === undefined) {
      // If action is undefined, remove the adminAction and adminActionTimestamp fields
      await docRef.update({
        adminAction: firebase.firestore.FieldValue.delete(),
        adminActionTimestamp: firebase.firestore.FieldValue.delete(),
      });
    } else {
      // Otherwise, set the new action and timestamp
      await docRef.update({
        adminAction: action,
        adminActionTimestamp: new Date(),
      });
    }
    res.status(200).json({ message: 'Admin action updated' });
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'An unknown error occurred' });
    }
  }
}
