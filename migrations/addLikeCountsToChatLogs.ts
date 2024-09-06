import { db } from '@/services/firebase';
import { getAnswersCollectionName } from '@/utils/server/firestoreUtils';

async function updateChatLogs() {
  const chatLogsRef = db.collection(getAnswersCollectionName());
  const snapshot = await chatLogsRef.get();

  const batch = db.batch();
  snapshot.forEach((doc) => {
    const data = doc.data();
    if (data.likeCount === undefined) {
      batch.update(doc.ref, { likeCount: 0 });
    }
  });

  await batch.commit();
  console.log('Updated all chatLogs documents with likeCount field');
}

updateChatLogs().catch(console.error);
