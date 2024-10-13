import { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcrypt';
import Cookies from 'cookies';
import crypto from 'crypto';
import cors, { runMiddleware } from 'utils/server/corsMiddleware';
import { genericRateLimiter } from '@/utils/server/genericRateLimiter';
import { isDevelopment } from '@/utils/env';
import validator from 'validator';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  await runMiddleware(req, res, cors);

  // Apply rate limiting
  const isAllowed = await genericRateLimiter(req, res, {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 8, // 8 requests per 15 minutes
    name: 'login',
  });

  if (!isAllowed) return;

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    const { password, redirect } = req.body;

    // Input validation
    if (typeof password !== 'string' || validator.isEmpty(password)) {
      return res.status(400).json({ message: 'Invalid password' });
    }

    if (!validator.isLength(password, { min: 6, max: 100 })) {
      return res.status(400).json({ message: 'Invalid password length' });
    }

    if (
      redirect &&
      redirect !== '/' &&
      !validator.isURL(redirect, {
        require_tld: false,
        allow_protocol_relative_urls: true,
        require_protocol: false,
        allow_fragments: false,
        allow_query_components: true,
      }) &&
      !redirect.startsWith('/')
    ) {
      console.log('Invalid redirect URL:', redirect);
      return res.status(400).json({ message: 'Invalid redirect URL' });
    }

    // Sanitize inputs
    const sanitizedPassword = password.trim();
    const sanitizedRedirect = redirect
      ? decodeURIComponent(redirect.trim())
      : '/';

    console.log('Received login request with redirect:', sanitizedRedirect);
    const storedHashedPassword = process.env.SITE_PASSWORD;
    const storedHashedToken = process.env.SECURE_TOKEN_HASH;
    const fixedToken = process.env.SECURE_TOKEN;

    if (
      !sanitizedPassword ||
      !storedHashedPassword ||
      !storedHashedToken ||
      !fixedToken
    ) {
      return res.status(400).json({ message: 'Bad request' });
    }

    const match = await bcrypt.compare(sanitizedPassword, storedHashedPassword);
    if (match) {
      const hashedToken = crypto
        .createHash('sha256')
        .update(fixedToken)
        .digest('hex');

      if (hashedToken !== storedHashedToken) {
        return res.status(500).json({ message: 'Server error' });
      }

      const isSecure =
        req.headers['x-forwarded-proto'] === 'https' || !isDevelopment();
      const cookies = new Cookies(req, res, { secure: isSecure });

      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + 12);

      // Add timestamp to the token
      const tokenWithTimestamp = `${fixedToken}:${Date.now()}`;

      cookies.set('siteAuth', tokenWithTimestamp, {
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
      return res
        .status(200)
        .json({ message: 'Authenticated', redirect: sanitizedRedirect });
    } else {
      return res.status(403).json({ message: 'Incorrect password' });
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}
