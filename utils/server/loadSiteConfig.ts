import { SiteConfig } from '@/types/siteConfig';

function parseSiteConfig(siteId: string = 'default'): SiteConfig | null {
  try {
    const allConfigs = JSON.parse(process.env.SITE_CONFIG || '{}');
    const siteConfig = allConfigs[siteId];

    if (!siteConfig) {
      throw new Error(`Configuration not found for site ID: ${siteId}`);
    }

    return {
      ...siteConfig,
      siteId,
      chatPlaceholder: siteConfig.chatPlaceholder || 'Ask a question...',
      header: siteConfig.header || { logo: '', navItems: [] },
      footer: siteConfig.footer || { links: [] },
    } as SiteConfig;
  } catch (error) {
    console.error('Error loading site config:', error);
    return null;
  }
}

export async function loadSiteConfig(
  siteId: string = 'default',
): Promise<SiteConfig | null> {
  return parseSiteConfig(siteId);
}

export function loadSiteConfigSync(
  siteId: string = 'default',
): SiteConfig | null {
  return parseSiteConfig(siteId);
}
