import { NextApiRequest, NextApiResponse } from 'next';

type ApiHandler = (req: NextApiRequest, res: NextApiResponse) => Promise<void>;

export function withApiMiddleware(handler: ApiHandler): ApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const referer = req.headers.referer || req.headers.referrer;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
    const isVercelPreview = process.env.VERCEL_ENV === 'preview';
    const isDevelopment = process.env.NODE_ENV === 'development';

    if (req.method === 'POST' && !isDevelopment) {
      if (!referer) {
        console.info(
          `POST request to ${req.url} without referer. IP: ${req.socket.remoteAddress}`,
        );
        // You might want to allow this, or handle it differently based on your security requirements
      } else if (typeof referer === 'string') {
        const refererUrl = new URL(referer);
        const baseUrlObj = new URL(baseUrl);

        if (!isVercelPreview && refererUrl.hostname !== baseUrlObj.hostname) {
          console.warn(
            `POST request to ${req.url} with invalid referer. IP: ${req.socket.remoteAddress}, Referer: ${referer}`,
          );
          return res
            .status(403)
            .json({ message: 'Forbidden: Invalid referer' });
        }
      }
    }

    // If all checks pass, call the original handler
    await handler(req, res);
  };
}
