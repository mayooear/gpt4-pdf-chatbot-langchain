import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

// Type for the configuration
interface SiteConfig {
  name: string;
  greeting: string;
  collectionConfig: {
    [key: string]: string;
  };
}

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

// Function to load the configuration
async function loadConfig(siteId: string): Promise<SiteConfig | null> {
  try {
    const configPath = path.join(process.cwd(), 'site-config/config.json');
    const configData = fs.readFileSync(configPath, 'utf8');
    const allConfigs = JSON.parse(configData);
    const config = allConfigs[siteId];

    if (!config) {
      throw new Error(`Configuration not found for site ID: ${siteId}`);
    }

    if (
      typeof config === 'object' &&
      'name' in config &&
      'greeting' in config &&
      'collectionConfig' in config
    ) {
      return config as SiteConfig;
    } else {
      throw new Error(`Invalid configuration format for site ID: ${siteId}`);
    }
  } catch (error) {
    console.error(`Error loading config`, error);
    return null;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const siteId = process.env.SITE_ID || 'default';
  const config = await loadConfig(siteId);

  if (!config) {
    return res.status(404).json({ error: 'Configuration not found' });
  }

  // Return the configuration
  res.status(200).json(config);
}
