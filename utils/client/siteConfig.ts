import { SiteConfig } from '@/types/siteConfig';

// These functions can be used in components that receive siteConfig as a prop
export const getCollectionsConfig = (siteConfig: SiteConfig | null) =>
  siteConfig?.collectionConfig ?? {};

export type CollectionKey = keyof ReturnType<typeof getCollectionsConfig>;

export const getSiteName = (siteConfig: SiteConfig | null) =>
  siteConfig?.name ?? 'AI Chatbot';

export const getTagline = (siteConfig: SiteConfig | null) =>
  siteConfig?.tagline ?? 'Explore, Discover, Learn';

export const getParentSiteUrl = (siteConfig: SiteConfig | null) =>
  siteConfig?.parent_site_url ?? '';

export const getParentSiteName = (siteConfig: SiteConfig | null) =>
  siteConfig?.parent_site_name ?? '';

export function getGreeting(siteConfig: SiteConfig | null): string {
  return siteConfig?.greeting ?? 'Hello! How can I assist you today?';
}

export const getLibraryMappings = (siteConfig: SiteConfig | null) =>
  siteConfig?.libraryMappings ?? {};

export const getEnableSuggestedQueries = (siteConfig: SiteConfig | null) =>
  siteConfig?.enableSuggestedQueries ?? false;

export const getEnableMediaTypeSelection = (siteConfig: SiteConfig | null) =>
  siteConfig?.enableMediaTypeSelection ?? false;

export const getEnableAuthorSelection = (siteConfig: SiteConfig | null) =>
  siteConfig?.enableAuthorSelection ?? false;

export const getWelcomePopupHeading = (siteConfig: SiteConfig | null) =>
  siteConfig?.welcome_popup_heading ?? 'Welcome!';

export const getOtherVisitorsReference = (siteConfig: SiteConfig | null) =>
  siteConfig?.other_visitors_reference ?? 'other visitors';
