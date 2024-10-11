import { SiteConfig } from '@/types/siteConfig';

function parseSiteConfig(siteId: string = 'default'): SiteConfig | null {
  try {
    const allConfigs = JSON.parse(process.env.SITE_CONFIG || '{}');
    const siteConfig = allConfigs[siteId];

    if (!siteConfig) {
      console.error(`Configuration not found for site ID: ${siteId}`);
      console.log('Available site IDs:', Object.keys(allConfigs));
      throw new Error(`Configuration not found for site ID: ${siteId}`);
    }

    return {
      ...siteConfig,
      siteId,
      chatPlaceholder: siteConfig.chatPlaceholder || 'Ask a question...',
      header: siteConfig.header || { logo: '', navItems: [] },
      footer: siteConfig.footer || { links: [] },
      name: siteConfig.shortname || siteConfig.name,
      includedLibraries: siteConfig.includedLibraries || null,
    } as SiteConfig;
  } catch (error) {
    console.error('Error parsing site config:', error);
    return null;
  }
}

export async function loadSiteConfig(
  siteId?: string,
): Promise<SiteConfig | null> {
  const configSiteId = siteId || process.env.SITE_ID || 'default';
  return parseSiteConfig(configSiteId);
}

export function loadSiteConfigSync(siteId?: string): SiteConfig | null {
  const configSiteId = siteId || process.env.SITE_ID || 'default';
  return parseSiteConfig(configSiteId);
}
