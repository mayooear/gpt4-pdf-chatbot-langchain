import crypto from 'crypto';
import bcrypt from 'bcrypt';
import Cookies from 'cookies';
import { NextApiRequest, NextApiResponse } from 'next';
import { isDevelopment } from '@/utils/env';

const secretKey = crypto.createHash('sha256').update(process.env.SECRET_KEY || 'fIp0%%wgKqmJ0aqtQo').digest();

function encrypt(text: string) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', secretKey, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text: string) {
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', secretKey, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Decryption failed');
  }
}

function getClientIp(req: NextApiRequest): string {
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (xForwardedFor) {
    const ips = (xForwardedFor as string).split(',');
    return ips[0].trim();
  }
  return req.socket.remoteAddress || '';
}

async function setSudoCookie(req: NextApiRequest, res: NextApiResponse, password: string) {
  const isSecure = req.headers['x-forwarded-proto'] === 'https' || !isDevelopment();
  const cookies = new Cookies(req, res, { secure: isSecure });
  const sudoCookieName = 'blessed';
  const userIp = getClientIp(req);
  const storedHashedPassword = process.env.SUDO_PASSWORD;

  if (!password || !storedHashedPassword) {
    throw new Error('Bad request');
  }

  const match = await bcrypt.compare(password, storedHashedPassword);

  if (match) {
    const token = crypto.randomBytes(64).toString('hex');
    const encryptedToken = encrypt(`${token}:${userIp}`);
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1); // Set expiry to 1 year from now
    cookies.set(sudoCookieName, encryptedToken, { 
      httpOnly: true, 
      secure: isSecure, 
      sameSite: 'strict', 
      expires: expiryDate,
      maxAge: 365 * 24 * 60 * 60 * 1000 // 1 year in milliseconds
    });
    return { message: 'You have been blessed' };
  } else {
    throw new Error('Incorrect password');
  }
}

function getSudoCookie(req: NextApiRequest, res: NextApiResponse) {
  const isSecure = req.headers['x-forwarded-proto'] === 'https' || !isDevelopment();
  const cookies = new Cookies(req, res, { secure: isSecure });
  const sudoCookieName = 'blessed';
  const userIp = getClientIp(req);
  const encryptedToken = cookies.get(sudoCookieName);

  if (encryptedToken) {
    try {
      const textParts = encryptedToken.split(':');
      if (textParts.length !== 2) {
        console.error('Invalid token format');
        return { sudoCookieValue: false, message: 'Invalid token format' };
      }
      const decryptedToken = decrypt(encryptedToken);
      const tokenIndex = decryptedToken.indexOf(':');
      const token = decryptedToken.slice(0, tokenIndex);
      const ip = decryptedToken.slice(tokenIndex + 1);
      if (ip === userIp) {
        return { sudoCookieValue: true };
      } else {
        console.error('GetSudoCookie: IP mismatch: Extracted IP does not match User IP');
        return { sudoCookieValue: false, message: 'IP mismatch: Extracted IP does not match User IP' };
      }
    } catch (error) {
      console.error('Token validation error:', error);
      return { sudoCookieValue: false, message: 'Token validation error' };
    }
  } else {
    return { sudoCookieValue: false, message: '' };
  }
}

function deleteSudoCookie(req: NextApiRequest, res: NextApiResponse) {
  const isSecure = req.headers['x-forwarded-proto'] === 'https' || !isDevelopment();
  const cookies = new Cookies(req, res, { secure: isSecure });
  const sudoCookieName = 'blessed';
  cookies.set(sudoCookieName, '', { expires: new Date(0) });
  return { message: 'You are not blessed' };
}

export { setSudoCookie, getSudoCookie, deleteSudoCookie };