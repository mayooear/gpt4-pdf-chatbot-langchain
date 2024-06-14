import { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcrypt';
import Cookies from 'cookies';
import cors, { runMiddleware } from '@/utils/server/corsMiddleware';
import rateLimit from 'express-rate-limit';
import { Request } from 'express';

// Custom key generator to handle IP extraction
const keyGenerator = (req: Request) => {
  const nextReq = req as unknown as NextApiRequest;
  return nextReq.headers['x-forwarded-for'] || nextReq.connection.remoteAddress || '127.0.0.1';
};

// Initialize rate limiter with custom key generator
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  keyGenerator: (req: Request) => {
    const nextReq = req as unknown as NextApiRequest;
    return nextReq.headers['x-forwarded-for']?.toString() || nextReq.connection.remoteAddress || '127.0.0.1';
  },
  handler: (req: Request, res: any) => {
    const nextRes = res as unknown as NextApiResponse;
    nextRes.status(429).json({ message: 'Too many login attempts, please try again later.' });
  },
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await runMiddleware(req, res, cors);

  // Apply rate limiting
  await new Promise((resolve, reject) => {
    limiter(req as unknown as Request, res as any, (result: any) => {
      if (result instanceof Error) {
        return reject(result);
      }
      resolve(result);
    });
  });

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  console.log(`Request method: ${req.method}`);

  if (req.method === 'POST') {
    const { password, redirect } = req.body;
    const storedHashedPassword = process.env.SITE_PASSWORD;

    if (!password || !storedHashedPassword) {
      return res.status(400).json({ message: 'Bad request' });
    }

    const match = await bcrypt.compare(password, storedHashedPassword);
    if (match) {
      const isSecure = req.headers['x-forwarded-proto'] === 'https' || process.env.ENVIRONMENT !== 'dev';
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
