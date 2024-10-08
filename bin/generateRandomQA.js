#!/usr/bin/env node

/**
 * generateRandomQA.js
 *
 * This script generates random Q&A entries and adds them to a Firestore database.
 * It uses the site ID to load the appropriate environment variables and Firebase configuration.
 *
 * Usage:
 *   node bin/generateRandomQA.js <siteId> <count>
 *
 * Arguments:
 *   siteId: The site identifier used to load the correct .env file (e.g., 'crystal' for .env.crystal)
 *   count: The number of random Q&A entries to generate and add to Firestore
 *
 * Example:
 *   node bin/generateRandomQA.js crystal 5
 *
 * This will generate 5 random Q&A entries and add them to the Firestore database
 * configured for the 'crystal' site.
 *
 * Make sure the appropriate .env.<siteId> file exists in the project root
 * with the necessary Firebase configuration.
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));

const siteId = process.argv[2];
const count = parseInt(process.argv[3], 10);

if (!siteId || isNaN(count) || count <= 0) {
  console.error('Usage: node generateRandomQA.js <siteId> <count>');
  process.exit(1);
}

const envPath = resolve(__dirname, '..', `.env.${siteId}`);
config({ path: envPath });

let db;

// Initialize the Firebase admin SDK
if (getApps().length === 0) {
  const serviceAccountJson = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (typeof serviceAccountJson !== 'string') {
    if (serviceAccountJson === undefined) {
      throw new Error(
        'The GOOGLE_APPLICATION_CREDENTIALS environment variable is not set.',
      );
    } else {
      throw new Error(
        'The GOOGLE_APPLICATION_CREDENTIALS environment variable is not a string.',
      );
    }
  }
  const serviceAccount = JSON.parse(serviceAccountJson);

  const app = initializeApp({
    credential: cert(serviceAccount),
  });

  db = getFirestore(app);
} else {
  db = getFirestore();
}

// Inline implementation of getAnswersCollectionName
const getAnswersCollectionName = () => {
  // hardwired to dev since we don't want to accidentally add dev data to prod
  const env = 'dev';
  return `${env}_chatLogs`;
};

function generateRandomWord(length) {
  return Array.from({ length }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26)),
  ).join('');
}

function generateRandomSentence(wordCount) {
  return Array.from({ length: wordCount }, () =>
    generateRandomWord(Math.floor(Math.random() * 10) + 1),
  ).join(' ');
}

async function generateRandomQA(count) {
  const answerRef = db.collection(getAnswersCollectionName());

  for (let i = 0; i < count; i++) {
    const answerEntry = {
      question: generateRandomSentence(5),
      answer: generateRandomSentence(20),
      collection: Math.random() < 0.5 ? 'master_swami' : 'whole_library',
      likeCount: Math.floor(Math.random() * 10),
      history: Array.from({ length: 3 }, () => ({
        question: generateRandomSentence(3),
        answer: generateRandomSentence(10),
      })),
      ip: `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`,
      timestamp: new Date(),
    };

    try {
      const docRef = await answerRef.add(answerEntry);
      console.log(
        `Successfully added entry ${i + 1}/${count} with ID: ${docRef.id}`,
      );
    } catch (error) {
      console.error(`Error adding entry ${i + 1}:`, error);
    }
  }

  console.log(`Finished adding ${count} random Q&A entries to Firestore.`);
}

generateRandomQA(count).catch((error) => {
  console.error('Error in generateRandomQA:', error);
});
