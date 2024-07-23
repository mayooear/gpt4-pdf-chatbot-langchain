import { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcrypt';
import Cookies from 'cookies';
import crypto from 'crypto';
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

  if (req.method === 'POST') {
    const { password, redirect } = req.body;
    const storedHashedPassword = process.env.SITE_PASSWORD;
    const storedHashedToken = process.env.SECURE_TOKEN_HASH;
    const fixedToken = process.env.SECURE_TOKEN;

    if (!password || !storedHashedPassword || !storedHashedToken || !fixedToken) {
      return res.status(400).json({ message: 'Bad request' });
    }

    const match = await bcrypt.compare(password, storedHashedPassword);
    if (match) {
      const hashedToken = crypto.createHash('sha256').update(fixedToken).digest('hex');

      if (hashedToken !== storedHashedToken) {
        return res.status(500).json({ message: 'Server error' });
      }

      const isSecure = req.headers['x-forwarded-proto'] === 'https' || !isDevelopment();
      const cookies = new Cookies(req, res, { secure: isSecure });

      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + 12);
      cookies.set('siteAuth', fixedToken, {
        httpOnly: true,
        secure: isSecure,
        expires: expiryDate,
        sameSite: 'lax',
      });
      // Less secure cookie that can be used for some things on the front end
      cookies.set('isLoggedIn', 'true', {
        httpOnly: false,
        secure: isSecure,
        expires: expiryDate,
        sameSite: 'lax',
      });
      return res.status(200).json({ message: 'Authenticated', redirect });
    } else {
      return res.status(403).json({ message: 'Incorrect password' });
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}