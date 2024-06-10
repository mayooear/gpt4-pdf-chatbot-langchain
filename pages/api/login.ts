import { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcrypt';
import Cookies from 'cookies';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
      const { password, redirect } = req.body;
      const storedHashedPassword = process.env.SITE_PASSWORD;
  
      if (!password || !storedHashedPassword) {
        return res.status(400).json({ message: 'Bad request' });
      }
  
      const match = await bcrypt.compare(password, storedHashedPassword);
      if (match) {
        const cookies = new Cookies(req, res);
        cookies.set('siteAuth', 'true', { httpOnly: true, secure: process.env.NODE_ENV === 'production' });
        return res.status(200).json({ message: 'Authenticated', redirect });
      } else {
        return res.status(403).json({ message: 'Incorrect password' });
      }
    } else {
      res.status(405).json({ message: 'Method not allowed' });
    }
}
