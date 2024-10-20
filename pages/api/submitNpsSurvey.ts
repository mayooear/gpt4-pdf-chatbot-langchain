import type { NextApiRequest, NextApiResponse } from 'next';
import { google } from 'googleapis';
import validator from 'validator';
import { withApiMiddleware } from '@/utils/server/apiMiddleware';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { uuid, score, feedback, additionalComments, timestamp } = req.body;

  // Input validation
  if (!validator.isUUID(uuid)) {
    return res.status(400).json({ message: 'Invalid UUID' });
  }

  if (!validator.isInt(score.toString(), { min: 0, max: 10 })) {
    return res.status(400).json({ message: 'Score must be between 0 and 10' });
  }

  if (feedback && feedback.length > 1000) {
    return res
      .status(400)
      .json({ message: 'Feedback must be 1000 characters or less' });
  }

  if (additionalComments && additionalComments.length > 1000) {
    return res
      .status(400)
      .json({ message: 'Additional comments must be 1000 characters or less' });
  }

  if (!validator.isISO8601(timestamp)) {
    return res.status(400).json({ message: 'Invalid timestamp' });
  }

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Missing Google credentials');
    return res.status(500).json({ message: 'Missing Google credentials' });
  }

  if (!process.env.NPS_SURVEY_GOOGLE_SHEET_ID) {
    console.error('Missing Google Sheet ID');
    return res.status(500).json({ message: 'Missing Google Sheet ID' });
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Check if UUID has submitted in the last month
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const oneMonthAgoTimestamp = oneMonthAgo.toISOString();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.NPS_SURVEY_GOOGLE_SHEET_ID,
      range: 'Responses!A:B',
    });

    const rows = response.data.values;
    if (rows) {
      const recentSubmission = rows.find(
        (row) => row[1] === uuid && row[0] > oneMonthAgoTimestamp,
      );

      if (recentSubmission) {
        return res
          .status(429)
          .json({ message: 'You can only submit one survey per month' });
      }
    }

    // If no recent submission, proceed with adding the new entry
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.NPS_SURVEY_GOOGLE_SHEET_ID,
      range: 'Responses',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[timestamp, uuid, score, feedback, additionalComments]],
      },
    });

    res.status(200).json({ message: 'Survey submitted successfully' });
  } catch (error) {
    console.error('Error submitting survey:', error);
    if (error instanceof Error) {
      res
        .status(500)
        .json({ message: `Error submitting survey: ${error.message}` });
    } else {
      res.status(500).json({
        message: 'An unknown error occurred while submitting the survey',
      });
    }
  }
}

export default withApiMiddleware(handler);
