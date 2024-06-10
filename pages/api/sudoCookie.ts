// This has pretty good security. It encrypts the cookie with a secret key
// and includes the user's IP address.

import { NextApiRequest, NextApiResponse } from 'next';
import Cors from 'cors';
import Cookies from 'cookies';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

// Initialize the cors middleware
const cors = Cors({
  methods: ['POST', 'GET', 'DELETE', 'OPTIONS'],
  origin: process.env.NEXT_PUBLIC_BASE_URL || '', // Allow requests from your frontend domain
  credentials: true,
});

// Helper method to wait for a middleware to execute before continuing
function runMiddleware(req: NextApiRequest, res: NextApiResponse, fn: Function) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result: any) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

const secretKey = crypto.createHash('sha256').update(process.env.SECRET_KEY || 'fIp0%%wgKqmJ0aqtQo').digest();

function encrypt(text: string) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', secretKey, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text: string) {
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift()!, 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', secretKey, iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Run the CORS middleware
  await runMiddleware(req, res, cors);

  // Handle OPTIONS requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const cookies = new Cookies(req, res);
  const sudoCookieName = 'blessed';
  const userIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  console.log(`Request method: ${req.method}`); // Log the request method
  console.log(`User IP: ${userIp}`); // Log the user IP
  console.log(`Request headers: ${JSON.stringify(req.headers)}`); // Log the request headers

  if (req.method === 'POST') {
    const { password } = req.body;
    const storedHashedPassword = process.env.SUDO_PASSWORD;

    if (!password || !storedHashedPassword) {
      res.status(400).json({ message: 'Bad request' });
      return;
    }

    const match = await bcrypt.compare(password, storedHashedPassword);

    if (match) {
      const token = crypto.randomBytes(64).toString('hex');
      const encryptedToken = encrypt(`${token}:${userIp}`);
      const isSecure = req.headers['x-forwarded-proto'] === 'https' || process.env.ENVIRONMENT !== 'dev'; // secure in production, not secure in development
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + 3); // Set cookie to expire in 3 months
      cookies.set(sudoCookieName, encryptedToken, { httpOnly: true, secure: isSecure, sameSite: 'strict', expires: expiryDate });
      res.status(200).json({ message: 'You have been blessed' });
    } else {
      res.status(403).json({ message: 'Incorrect password' });
    }
  } else if (req.method === 'GET') {
    const encryptedToken = cookies.get(sudoCookieName);
    if (encryptedToken) {
      try {
        const decryptedToken = decrypt(encryptedToken);
        const tokenIndex = decryptedToken.indexOf(':');
        const token = decryptedToken.slice(0, tokenIndex);
        const ip = decryptedToken.slice(tokenIndex + 1);
        if (ip === userIp) {
          res.status(200).json({ sudoCookieValue: true });
        } else {
          res.status(403).json({ message: 'Invalid token or IP mismatch' });
        }
      } catch (error) {
        res.status(403).json({ message: 'Invalid token' });
      }
    } else {
      res.status(403).json({ message: 'No token found' });
    }
  } else if (req.method === 'DELETE') {
    cookies.set(sudoCookieName, '', { expires: new Date(0) });
    res.status(200).json({ message: 'You are not blessed' });
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}
