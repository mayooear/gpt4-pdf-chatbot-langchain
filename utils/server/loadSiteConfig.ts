// This file contains utility functions for loading and parsing site configurations

import { SiteConfig } from '@/types/siteConfig';

/**
 * Parses the site configuration for a given site ID
 * @param siteId - The ID of the site to load configuration for (default: 'default')
 * @returns Parsed SiteConfig object or null if parsing fails
 */
function parseSiteConfig(siteId: string = 'default'): SiteConfig | null {
  try {
    // Parse the JSON string from environment variable
    const allConfigs = JSON.parse(process.env.SITE_CONFIG || '{}');
    const siteConfig = allConfigs[siteId];

    // Check if configuration exists for the given site ID
    if (!siteConfig) {
      console.error(`Configuration not found for site ID: ${siteId}`);
      console.log('Available site IDs:', Object.keys(allConfigs));
      throw new Error(`Configuration not found for site ID: ${siteId}`);
    }

    // Return the parsed configuration with default values for optional fields
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

/**
 * Asynchronously loads the site configuration
 * @param siteId - Optional site ID to load configuration for
 * @returns Promise resolving to SiteConfig object or null
 */
export async function loadSiteConfig(
  siteId?: string,
): Promise<SiteConfig | null> {
  const configSiteId = siteId || process.env.SITE_ID || 'default';
  return parseSiteConfig(configSiteId);
}

/**
 * Synchronously loads the site configuration
 * @param siteId - Optional site ID to load configuration for
 * @returns SiteConfig object or null
 */
export function loadSiteConfigSync(siteId?: string): SiteConfig | null {
  const configSiteId = siteId || process.env.SITE_ID || 'default';
  return parseSiteConfig(configSiteId);
}
