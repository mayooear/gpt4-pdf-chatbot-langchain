import { NextApiRequest, NextApiResponse } from 'next';

type ApiHandler = (req: NextApiRequest, res: NextApiResponse) => Promise<void>;

export function withApiMiddleware(handler: ApiHandler): ApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // Check for missing or suspicious referer
    const referer = req.headers.referer || req.headers.referrer;
    if (
      req.method === 'POST' &&
      (!referer ||
        (typeof referer === 'string' &&
          !referer.startsWith(process.env.NEXT_PUBLIC_BASE_URL || '')))
    ) {
      console.warn(
        `Suspicious POST request to ${req.url}: Missing or invalid referer. IP: ${req.socket.remoteAddress}`,
      );
      return res.status(403).json({ message: 'Forbidden: Invalid referer' });
    }

    // Add more common checks here as needed

    // If all checks pass, call the original handler
    await handler(req, res);
  };
}
