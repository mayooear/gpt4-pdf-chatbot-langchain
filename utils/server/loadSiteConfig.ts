import fs from 'fs/promises';
import path from 'path';
import { SiteConfig } from '@/types/siteConfig';

export async function loadSiteConfig(
  siteId: string = 'default',
): Promise<SiteConfig | null> {
  try {
    const configPath = path.join(process.cwd(), 'site-config', 'config.json');
    const configData = await fs.readFile(configPath, 'utf8');
    const allConfigs = JSON.parse(configData);
    const siteConfig = allConfigs[siteId];

    if (!siteConfig) {
      throw new Error(`Configuration not found for site ID: ${siteId}`);
    }

    return siteConfig as SiteConfig;
  } catch (error) {
    console.error('Error loading site config:', error);
    return null;
  }
}
