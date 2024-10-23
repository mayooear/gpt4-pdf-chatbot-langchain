// CORS middleware configuration
import Cors from 'cors';
import { NextApiRequest, NextApiResponse } from 'next';

// Configure CORS options
const cors = Cors({
  methods: ['POST', 'GET', 'DELETE', 'OPTIONS'],
  origin: process.env.NEXT_PUBLIC_BASE_URL || '',
  credentials: true,
});

// Helper function to run middleware
export function runMiddleware(
  req: NextApiRequest,
  res: NextApiResponse,
  fn: (
    req: NextApiRequest,
    res: NextApiResponse,
    callback: (result: unknown) => void,
  ) => void,
) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result: unknown) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

export default cors;
