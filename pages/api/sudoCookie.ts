import { NextApiRequest, NextApiResponse } from 'next';
import cors, { runMiddleware } from '@/utils/server/corsMiddleware';
import {
  setSudoCookie,
  getSudoCookie,
  deleteSudoCookie,
} from '@/utils/server/sudoCookieUtils';
import { genericRateLimiter } from '@/utils/server/genericRateLimiter';
import validator from 'validator';
import { withApiMiddleware } from '@/utils/server/apiMiddleware';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  await runMiddleware(req, res, cors);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    if (req.method === 'POST') {
      const isAllowed = await genericRateLimiter(req, res, {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 8, // 8 requests per 15 minutes
        name: 'sudo_cookie',
      });

      if (!isAllowed) {
        return; // Rate limiter already sent the response
      }

      const { password } = req.body;

      // Validate password
      if (!validator.isLength(password, { min: 8, max: 100 })) {
        return res.status(400).json({ message: 'Invalid password' });
      }

      const response = await setSudoCookie(req, res, password);
      res.status(200).json(response);
    } else if (req.method === 'GET') {
      const response = getSudoCookie(req, res);
      res.status(200).json(response);
    } else if (req.method === 'DELETE') {
      const response = deleteSudoCookie(req, res);
      res.status(200).json(response);
    } else {
      res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error('SudoCookie:', error);
    res.status(400).json({
      message:
        error instanceof Error ? error.message : 'An unknown error occurred',
    });
  }
}

export default withApiMiddleware(handler);
