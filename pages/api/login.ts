import { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcrypt';
import Cookies from 'cookies';
import cors, { runMiddleware } from 'utils/server/corsMiddleware';
import { rateLimiter } from 'utils/server/rateLimiter';
import { isDevelopment } from '@/utils/env';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await runMiddleware(req, res, cors);

  // Apply rate limiting
  const isAllowed = await rateLimiter(req, res);
  if (!isAllowed) return;

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  console.log(`Request method: ${req.method}`);

  if (req.method === 'POST') {
    const { password, redirect } = req.body;
    console.log('Received login request with redirect:', redirect);
    const storedHashedPassword = process.env.SITE_PASSWORD;

    if (!password || !storedHashedPassword) {
      return res.status(400).json({ message: 'Bad request' });
    }

    const match = await bcrypt.compare(password, storedHashedPassword);
    if (match) {
      const isSecure = req.headers['x-forwarded-proto'] === 'https' || !isDevelopment();
      const cookies = new Cookies(req, res, { secure: isSecure });

      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + 12);
      cookies.set('siteAuth', 'true', { httpOnly: true, secure: isSecure, expires: expiryDate });
      return res.status(200).json({ message: 'Authenticated', redirect });
    } else {
      return res.status(403).json({ message: 'Incorrect password' });
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}
