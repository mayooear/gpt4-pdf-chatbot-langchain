// import { isDevelopment } from '@/utils/env';
import * as fbadmin from 'firebase-admin';
import { initializeFirestore } from 'firebase-admin/firestore';

// Export the Firestore database
let db: fbadmin.firestore.Firestore;

// Initialize the Firebase admin SDK
if (!fbadmin.apps.length) {
  const serviceAccountJson = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (typeof serviceAccountJson !== 'string') {
    if (serviceAccountJson === undefined) {
      throw new Error(
        'The GOOGLE_APPLICATION_CREDENTIALS environment variable is not set.',
      );
    } else if (typeof serviceAccountJson !== 'string') {
      console.error('Type of serviceAccountJson:', typeof serviceAccountJson);
      throw new Error(
        'The GOOGLE_APPLICATION_CREDENTIALS environment variable is not a string.',
      );
    }
  }
  const serviceAccount = JSON.parse(serviceAccountJson);

  const app = fbadmin.initializeApp({
    credential: fbadmin.credential.cert(serviceAccount),
  });

  // Initialize Firestore with preferRest to improve cold start times
  initializeFirestore(app, { preferRest: true });
  db = fbadmin.firestore();

  // if (isDevelopment()) {
  //   db.settings({
  //     host: 'localhost:8080',
  //     ssl: false,
  //   });
  // }
  console.log('Firestore initialized');
} else {
  db = fbadmin.firestore();
}

export { db };
