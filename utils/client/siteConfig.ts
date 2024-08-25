import config from '@/config.json';

// Get the current site ID from an environment variable
const SITE_ID = process.env.SITE_ID || 'ananda';

// Get the site config for the current site
export interface SiteConfig {
  name: string;
  greeting: string;
  collectionConfig: {
    [key: string]: string;
  };
}

const siteConfig = config[SITE_ID as keyof typeof config] as SiteConfig;

// Export the collections config
export const collectionsConfig = siteConfig.collectionConfig;

export type CollectionKey = keyof typeof collectionsConfig;

// Utility function to get the site name
export const getSiteName = () => siteConfig.name;

// Add a function to get the greeting
export const getGreeting = () => siteConfig.greeting;

// Export the entire site config for use in other parts of the application
export default siteConfig;
