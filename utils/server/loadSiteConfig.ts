import { SiteConfig } from '@/types/siteConfig';

export async function loadSiteConfig(
  siteId: string = 'default',
): Promise<SiteConfig | null> {
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
