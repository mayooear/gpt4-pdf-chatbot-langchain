import type { NextApiRequest, NextApiResponse } from 'next';
import firebase from 'firebase-admin';
import { db } from '@/services/firebase'; 

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    // Make any query to avoid cold start problem
    const snapshot = db.collection(`${process.env.ENVIRONMENT}_chatLogs`)
                      .where(firebase.firestore.FieldPath.documentId(), 'in', ['000000'])
                      .get();
    console.log("Firestore cron done");
    res.status(200).end('Done');
}
