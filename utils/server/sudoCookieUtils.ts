import crypto from 'crypto';
import bcrypt from 'bcrypt';
import Cookies from 'cookies';
import { NextApiRequest, NextApiResponse } from 'next';

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

async function setSudoCookie(req: NextApiRequest, res: NextApiResponse, password: string) {
  const isSecure = req.headers['x-forwarded-proto'] === 'https' || process.env.ENVIRONMENT !== 'dev';
  const cookies = new Cookies(req, res, { secure: isSecure });
  const sudoCookieName = 'blessed';
  const userIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const storedHashedPassword = process.env.SUDO_PASSWORD;

  if (!password || !storedHashedPassword) {
    throw new Error('Bad request');
  }

  const match = await bcrypt.compare(password, storedHashedPassword);

  if (match) {
    const token = crypto.randomBytes(64).toString('hex');
    const encryptedToken = encrypt(`${token}:${userIp}`);
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + 12);
    cookies.set(sudoCookieName, encryptedToken, 
      { httpOnly: true, secure: isSecure, sameSite: 'strict', expires: expiryDate });
    return { message: 'You have been blessed' };
  } else {
    throw new Error('Incorrect password');
  }
}

function getSudoCookie(req: NextApiRequest, res: NextApiResponse) {
  const isSecure = req.headers['x-forwarded-proto'] === 'https' || process.env.ENVIRONMENT !== 'dev';
  const cookies = new Cookies(req, res, { secure: isSecure });
  const sudoCookieName = 'blessed';
  const userIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const encryptedToken = cookies.get(sudoCookieName);

  if (encryptedToken) {
    try {
      const decryptedToken = decrypt(encryptedToken);
      const tokenIndex = decryptedToken.indexOf(':');
      const token = decryptedToken.slice(0, tokenIndex);
      const ip = decryptedToken.slice(tokenIndex + 1);
      if (ip === userIp) {
        return { sudoCookieValue: true };
      } else {
        throw new Error('Invalid token or IP mismatch');
      }
    } catch (error) {
      throw new Error('Invalid token');
    }
  } else {
    throw new Error('No token found');
  }
}

function deleteSudoCookie(req: NextApiRequest, res: NextApiResponse) {
  const isSecure = req.headers['x-forwarded-proto'] === 'https' || process.env.ENVIRONMENT !== 'dev';
  const cookies = new Cookies(req, res, { secure: isSecure });
  const sudoCookieName = 'blessed';
  cookies.set(sudoCookieName, '', { expires: new Date(0) });
  return { message: 'You are not blessed' };
}

export { setSudoCookie, getSudoCookie, deleteSudoCookie };
