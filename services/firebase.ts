import * as fbadmin from 'firebase-admin';

// Initialize the Firebase admin SDK
if (!fbadmin.apps.length) {
  const serviceAccountJson = process.env.FIREBASE_ADMINSDK_JSON;
  if (typeof serviceAccountJson !== 'string') {
    throw new Error('The FIREBASE_ADMINSDK_JSON environment variable is not set or not a string.');
  }
  const serviceAccount = JSON.parse(serviceAccountJson);

  fbadmin.initializeApp({
    credential: fbadmin.credential.cert(serviceAccount),
  });
}

// Export the Firestore database
export const db = fbadmin.firestore();
