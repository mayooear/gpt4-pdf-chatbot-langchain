import type { NextApiRequest, NextApiResponse } from 'next';
import {
  updateRelatedQuestionsBatch,
  updateRelatedQuestions,
} from '@/utils/server/relatedQuestionsUtils';
import { withApiMiddleware } from '@/utils/server/apiMiddleware';
import { RelatedQuestion } from '@/types/RelatedQuestion';

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{
    message: string;
    relatedQuestions?: RelatedQuestion[];
    error?: string;
  }>,
) {
  if (req.method === 'GET') {
    const { updateBatch } = req.query;

    if (!updateBatch || typeof updateBatch !== 'string') {
      return res.status(400).json({
        message: 'updateBatch parameter is required and must be a string.',
      });
    }

    const batchSize = parseInt(updateBatch);
    if (isNaN(batchSize)) {
      return res.status(400).json({
        message: 'updateBatch must be a valid number.',
      });
    }

    console.log('Batch updating related questions with batch size:', batchSize);

    try {
      await updateRelatedQuestionsBatch(batchSize);
      return res
        .status(200)
        .json({ message: 'Related questions updated successfully' });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Error updating related questions';
      console.error('Error updating related questions: ', errorMessage);
      return res.status(500).json({
        message: 'Error updating related questions',
        error: errorMessage,
      });
    }
  } else if (req.method === 'POST') {
    const { docId } = req.body;

    if (!docId || typeof docId !== 'string') {
      return res.status(400).json({
        message: 'docId is required and must be a string.',
      });
    }

    console.log('Updating related questions for document:', docId);

    try {
      const relatedQuestions = await updateRelatedQuestions(docId);
      console.log(
        'relatedQuestions from updateRelatedQuestions:',
        relatedQuestions,
      );
      return res.status(200).json({
        message: 'Related questions updated successfully',
        relatedQuestions,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Error updating related questions';
      console.error('Error updating related questions: ', errorMessage);
      return res.status(500).json({
        message: 'Error updating related questions',
        error: errorMessage,
      });
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}

export default withApiMiddleware(handler);
