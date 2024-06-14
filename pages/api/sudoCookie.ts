import { NextApiRequest, NextApiResponse } from 'next';
import cors, { runMiddleware } from '@/utils/server/corsMiddleware';
import { setSudoCookie, getSudoCookie, deleteSudoCookie } from '@/utils/server/sudoCookieUtils';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await runMiddleware(req, res, cors);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    if (req.method === 'POST') {
      const { password } = req.body;
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
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
}
