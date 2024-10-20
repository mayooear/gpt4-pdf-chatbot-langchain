import type { NextApiRequest, NextApiResponse } from 'next';
import firebase from 'firebase-admin';
import { db } from '@/services/firebase';
import { getAnswersCollectionName } from '@/utils/server/firestoreUtils';
import { withApiMiddleware } from '@/utils/server/apiMiddleware';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Make any query to avoid cold start problem
  await db
    .collection(getAnswersCollectionName())
    .where(firebase.firestore.FieldPath.documentId(), 'in', ['000000'])
    .get();
  console.log('Firestore cron done');
  res.status(200).end('Done');
}

export default withApiMiddleware(handler);
