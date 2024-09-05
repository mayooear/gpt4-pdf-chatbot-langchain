import type { NextApiRequest, NextApiResponse } from 'next';
import firebase from 'firebase-admin';
import { db } from '@/services/firebase';
import { getChatLogsCollectionName } from '@/utils/server/firestoreUtils';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Make any query to avoid cold start problem
  db.collection(getChatLogsCollectionName())
    .where(firebase.firestore.FieldPath.documentId(), 'in', ['000000'])
    .get();
  console.log('Firestore cron done');
  res.status(200).end('Done');
}
