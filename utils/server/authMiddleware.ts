import { NextApiRequest, NextApiResponse } from 'next';
import Cookies from 'cookies';
import { isTokenValid } from './passwordUtils';

export function authMiddleware(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>,
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const cookies = new Cookies(req, res);
    const token = cookies.get('siteAuth');

    if (!token || !isTokenValid(token)) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    await handler(req, res);
  };
}
