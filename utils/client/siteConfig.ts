export interface SiteConfig {
  name: string;
  greeting: string;
  collectionConfig: {
    [key: string]: string;
  };
}

// These functions can be used in components that receive siteConfig as a prop
export const getCollectionsConfig = (siteConfig: SiteConfig) =>
  siteConfig.collectionConfig;

export type CollectionKey = keyof ReturnType<typeof getCollectionsConfig>;

export const getSiteName = (siteConfig: SiteConfig) => siteConfig.name;

export const getGreeting = (siteConfig: SiteConfig) => siteConfig.greeting;
