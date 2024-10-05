export interface HeaderConfig {
  logo: string;
  navItems: Array<{ label: string; path: string }>;
}

export interface FooterConfig {
  links: Array<{
    label: string;
    url: string;
    icon?: string;
  }>;
}

export interface SiteConfig {
  siteId: string;
  shortname: string;
  name: string;
  tagline: string;
  greeting: string;
  parent_site_url: string;
  parent_site_name: string;
  help_url: string;
  help_text: string;
  collectionConfig: {
    [key: string]: string;
  };
  libraryMappings: {
    [key: string]: {
      displayName: string;
      url: string;
    };
  };
  enableSuggestedQueries: boolean;
  enableMediaTypeSelection: boolean;
  enableAuthorSelection: boolean;
  welcome_popup_heading: string;
  other_visitors_reference: string;
  loginImage: string | null;
  chatPlaceholder?: string;
  header: HeaderConfig;
  footer: FooterConfig;
  requireLogin: boolean;
  allowPrivateSessions: boolean;
  allowAllAnswersPage: boolean;
}
