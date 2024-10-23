// This file contains utility functions for accessing and managing site configuration
// It provides helper functions to retrieve specific configuration values with fallbacks
// These functions are designed for components that receive siteConfig as a prop

import { SiteConfig, HeaderConfig, FooterConfig } from '@/types/siteConfig';

// Helper function to get collections configuration
// Returns an empty object if not defined in siteConfig
export const getCollectionsConfig = (siteConfig: SiteConfig | null) =>
  siteConfig?.collectionConfig ?? {};

// Type definition for collection keys
// This allows for type-safe access to collection configurations
export type CollectionKey = keyof ReturnType<typeof getCollectionsConfig>;

// Helper functions to retrieve specific site configuration values
// Each function provides a default fallback value if the configuration is not set

// Get site name (defaults to 'The AI Chatbot')
export const getSiteName = (siteConfig: SiteConfig | null) =>
  siteConfig?.name ?? 'The AI Chatbot';

// Get site shortname (defaults to 'AI Chatbot')
export const getShortname = (siteConfig: SiteConfig | null) =>
  siteConfig?.shortname ?? 'AI Chatbot';

// Get site tagline (defaults to 'Explore, Discover, Learn')
export const getTagline = (siteConfig: SiteConfig | null) =>
  siteConfig?.tagline ?? 'Explore, Discover, Learn';

// Get parent site URL (defaults to an empty string)
export const getParentSiteUrl = (siteConfig: SiteConfig | null) =>
  siteConfig?.parent_site_url ?? '';

// Get parent site name (defaults to an empty string)
export const getParentSiteName = (siteConfig: SiteConfig | null) =>
  siteConfig?.parent_site_name ?? '';

// Get greeting message (defaults to a generic greeting)
export function getGreeting(siteConfig: SiteConfig | null): string {
  return siteConfig?.greeting ?? 'Hello! How can I assist you today?';
}

// Get library mappings (defaults to an empty object)
export const getLibraryMappings = (siteConfig: SiteConfig | null) =>
  siteConfig?.libraryMappings ?? {};

// Feature flag getters with default fallbacks
// These functions allow for easy toggling of features based on site configuration

// Check if suggested queries feature is enabled (defaults to false)
export const getEnableSuggestedQueries = (siteConfig: SiteConfig | null) =>
  siteConfig?.enableSuggestedQueries ?? false;

// Check if media type selection feature is enabled (defaults to false)
export const getEnableMediaTypeSelection = (siteConfig: SiteConfig | null) =>
  siteConfig?.enableMediaTypeSelection ?? false;

// Check if author selection feature is enabled (defaults to false)
export const getEnableAuthorSelection = (siteConfig: SiteConfig | null) =>
  siteConfig?.enableAuthorSelection ?? false;

// Get welcome popup heading (defaults to 'Welcome!')
export const getWelcomePopupHeading = (siteConfig: SiteConfig | null) =>
  siteConfig?.welcome_popup_heading ?? 'Welcome!';

// Get reference to other visitors (defaults to 'other visitors')
export const getOtherVisitorsReference = (siteConfig: SiteConfig | null) =>
  siteConfig?.other_visitors_reference ?? 'other visitors';

// Get login image (defaults to null)
export const getLoginImage = (siteConfig: SiteConfig | null) =>
  siteConfig?.loginImage ?? null;

// Get chat placeholder text (defaults to an empty string)
export function getChatPlaceholder(siteConfig: SiteConfig | null): string {
  return siteConfig?.chatPlaceholder || '';
}

// Get header configuration (defaults to empty logo and nav items)
export const getHeaderConfig = (
  siteConfig: SiteConfig | null,
): HeaderConfig => {
  return siteConfig?.header ?? { logo: '', navItems: [] };
};

// Get footer configuration (defaults to empty links array)
export const getFooterConfig = (
  siteConfig: SiteConfig | null,
): FooterConfig => {
  return siteConfig?.footer ?? { links: [] };
};

// Check if login is required (defaults to true)
export const getRequireLogin = (siteConfig: SiteConfig | null): boolean =>
  siteConfig?.requireLogin ?? true;

// Check if private sessions are allowed (defaults to false)
export const getAllowPrivateSessions = (
  siteConfig: SiteConfig | null,
): boolean => siteConfig?.allowPrivateSessions ?? false;

// Check if the "All Answers" page is allowed (defaults to false)
export const getAllowAllAnswersPage = (
  siteConfig: SiteConfig | null,
): boolean => siteConfig?.allowAllAnswersPage ?? false;

// Get enabled media types (defaults to all types: text, audio, and youtube)
export const getEnabledMediaTypes = (
  siteConfig: SiteConfig | null,
): ('text' | 'audio' | 'youtube')[] =>
  siteConfig?.enabledMediaTypes ?? ['text', 'audio', 'youtube'];
