// This has pretty good security. It encrypts the cookie with a secret key
// and includes the user's IP address.
 
import Cookies from 'cookies';
import bcrypt from 'bcrypt';
import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';

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
  const cookies = new Cookies(req, res);
  const sudoCookieName = 'blessed';
  const userIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

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
      const isSecure = process.env.ENVIRONMENT !== 'dev'; // secure in production, not secure in development
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