import * as fbadmin from 'firebase-admin';
import { initializeFirestore } from 'firebase-admin/firestore';

// Initialize the Firebase admin SDK
if (!fbadmin.apps.length) {
  const serviceAccountJson = process.env.FIREBASE_ADMINSDK_JSON;
  if (typeof serviceAccountJson !== 'string') {
    throw new Error('The FIREBASE_ADMINSDK_JSON environment variable is not set or not a string.');
  }
  const serviceAccount = JSON.parse(serviceAccountJson);

  const app = fbadmin.initializeApp({
    credential: fbadmin.credential.cert(serviceAccount),
  });

  // Initialize Firestore with preferRest to improve cold start times
  const db = initializeFirestore(app, { preferRest: true });
}

// Export the Firestore database
export const db = fbadmin.firestore();
