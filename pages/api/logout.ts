import { NextApiRequest, NextApiResponse } from 'next';
import Cookies from 'cookies';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const cookies = new Cookies(req, res);
    cookies.set('siteAuth', '', { expires: new Date(0) });
    res.status(200).json({ message: 'Logged out' });
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}
