import type { NextApiRequest, NextApiResponse } from 'next';
import {
  updateRelatedQuestionsBatch,
  updateRelatedQuestions,
} from '@/utils/server/relatedQuestionsUtils';
import { withApiMiddleware } from '@/utils/server/apiMiddleware';
import { RelatedQuestion } from '@/types/RelatedQuestion';

/**
 * API handler for managing related questions.
 * Supports batch updates (GET) and individual question updates (POST).
 */
async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{
    message: string;
    relatedQuestions?: RelatedQuestion[];
    error?: string;
  }>,
) {
  if (req.method === 'GET') {
    // Handle batch update of related questions
    const { updateBatch } = req.query;

    // Validate updateBatch parameter
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
      // Perform batch update of related questions
      await updateRelatedQuestionsBatch(batchSize);
      return res
        .status(200)
        .json({ message: 'Related questions batch update successful' });
    } catch (error: unknown) {
      // Handle and log errors during batch update
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
    // Handle update of related questions for a single document
    const { docId } = req.body;

    // Validate docId parameter
    if (!docId || typeof docId !== 'string') {
      return res.status(400).json({
        message: 'docId is required and must be a string.',
      });
    }

    try {
      // Update related questions for the specified document
      const relatedQuestions = await updateRelatedQuestions(docId);
      return res.status(200).json({
        message: 'Related questions updated successfully',
        relatedQuestions,
      });
    } catch (error: unknown) {
      // Handle and log errors during individual update
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
    // Handle unsupported HTTP methods
    res.status(405).json({ message: 'Method not allowed' });
  }
}

// Apply API middleware for additional processing (e.g., authentication, logging)
export default withApiMiddleware(handler);
