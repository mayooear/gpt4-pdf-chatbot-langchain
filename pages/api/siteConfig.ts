import { NextApiRequest, NextApiResponse } from 'next';
import { loadSiteConfig } from '@/utils/server/loadSiteConfig';

// // Function to determine the site ID from the request
// function getSiteId(req: NextApiRequest): string {
//   // You can implement your own logic here. For example:
//   // - Check a custom header
//   // - Look at the hostname
//   // - Use a query parameter
//   // For this example, we'll use a query parameter
//   const { siteId } = req.query;
//   return typeof siteId === 'string' ? siteId : 'default';
// }

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const siteId =
    (req.query.siteId as string) || process.env.SITE_ID || 'default';
  const config = await loadSiteConfig(siteId);

  if (!config) {
    return res.status(404).json({ error: 'Configuration not found' });
  }

  res.status(200).json(config);
}
