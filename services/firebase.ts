import * as fbadmin from 'firebase-admin';
import { initializeFirestore } from 'firebase-admin/firestore';

// Initialize the Firebase admin SDK
if (!fbadmin.apps.length) {
  const serviceAccountJson = process.env.FIREBASE_ADMINSDK_JSON;
  if (typeof serviceAccountJson !== 'string') {
    if (serviceAccountJson === undefined) {
      throw new Error(
        'The FIREBASE_ADMINSDK_JSON environment variable is not set.',
      );
    } else if (typeof serviceAccountJson !== 'string') {
      console.error('Type of serviceAccountJson:', typeof serviceAccountJson);
      throw new Error(
        'The FIREBASE_ADMINSDK_JSON environment variable is not a string.',
      );
    }
  }
  const serviceAccount = JSON.parse(serviceAccountJson);

  const app = fbadmin.initializeApp({
    credential: fbadmin.credential.cert(serviceAccount),
  });

  // Initialize Firestore with preferRest to improve cold start times
  initializeFirestore(app, { preferRest: true });

  // Remove the emulator settings
  // if (isDevelopment()) {
  //   db.settings({
  //     host: 'localhost:8080',
  //     ssl: false,
  //   });
  // }
  console.log('Firestore initialized');
}

// Export the Firestore database
export const db = fbadmin.firestore();
