import Cookies from 'cookies';
import bcrypt from 'bcrypt';
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const cookies = new Cookies(req, res);
  const sudoCookieName = 'blessed';

  if (req.method === 'POST') {
    const { password } = req.body;
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    if (!password || !hashedPassword) {
      res.status(400).json({ message: 'Bad request' });
      return;
    }
    const match = await bcrypt.compare(password, hashedPassword);

    if (match) {
      console.log("matched")
      const isSecure = process.env.ENVIRONMENT !== 'dev'; // secure in production, not secure in development
      cookies.set(sudoCookieName, '1', { httpOnly: true, secure: isSecure, sameSite: 'strict' });
      res.status(200).json({ message: 'You have been blessed' });
    } else {
      console.log("NOT matched")
      res.status(403).json({ message: 'Incorrect password' });
    }
  } else if (req.method === 'GET') {
    if (typeof sudoCookieName === 'string') {
      const sudoCookieValue = cookies.get(sudoCookieName);
      res.status(200).json({ sudoCookieValue });
    } else {
      res.status(500).json({ message: 'Server error: SUDO_COOKIE_NAME not defined' });
    }
  } else if (req.method === 'DELETE') {
    cookies.set(sudoCookieName, '', { expires: new Date(0) });
    res.status(200).json({ message: 'You are not blessed' });
  }
  else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}
  
