import { SiteConfig, HeaderConfig, FooterConfig } from '@/types/siteConfig';

// These functions can be used in components that receive siteConfig as a prop
export const getCollectionsConfig = (siteConfig: SiteConfig | null) =>
  siteConfig?.collectionConfig ?? {};

export type CollectionKey = keyof ReturnType<typeof getCollectionsConfig>;

export const getSiteName = (siteConfig: SiteConfig | null) =>
  siteConfig?.name ?? 'The AI Chatbot';

export const getShortname = (siteConfig: SiteConfig | null) =>
  siteConfig?.shortname ?? 'AI Chatbot';

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

export const getLoginImage = (siteConfig: SiteConfig | null) =>
  siteConfig?.loginImage ?? null;

export function getChatPlaceholder(siteConfig: SiteConfig | null): string {
  return siteConfig?.chatPlaceholder || '';
}

export const getHeaderConfig = (
  siteConfig: SiteConfig | null,
): HeaderConfig => {
  return siteConfig?.header ?? { logo: '', navItems: [] };
};

export const getFooterConfig = (
  siteConfig: SiteConfig | null,
): FooterConfig => {
  return siteConfig?.footer ?? { links: [] };
};

export const getRequireLogin = (siteConfig: SiteConfig | null): boolean =>
  siteConfig?.requireLogin ?? true;

export const getAllowPrivateSessions = (
  siteConfig: SiteConfig | null,
): boolean => siteConfig?.allowPrivateSessions ?? false;

export const getAllowAllAnswersPage = (
  siteConfig: SiteConfig | null,
): boolean => siteConfig?.allowAllAnswersPage ?? false;

export const getEnabledMediaTypes = (
  siteConfig: SiteConfig | null,
): ('text' | 'audio' | 'youtube')[] =>
  siteConfig?.enabledMediaTypes ?? ['text', 'audio', 'youtube'];
