import Cors from 'cors';
import { NextApiRequest, NextApiResponse } from 'next';

const cors = Cors({
  methods: ['POST', 'GET', 'DELETE', 'OPTIONS'],
  origin: process.env.NEXT_PUBLIC_BASE_URL || '',
  credentials: true,
});

export function runMiddleware(req: NextApiRequest, res: NextApiResponse, fn: Function) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result: any) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

export default cors;
