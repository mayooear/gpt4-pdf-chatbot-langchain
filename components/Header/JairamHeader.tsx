import BaseHeader from './BaseHeader';
import { SiteConfig } from '@/types/siteConfig';
import { getParentSiteUrl, getParentSiteName } from '@/utils/client/siteConfig';

interface JairamHeaderProps {
  siteConfig: SiteConfig;
}

export default function JairamHeader({ siteConfig }: JairamHeaderProps) {
  const parentSiteUrl = getParentSiteUrl(siteConfig);
  const parentSiteName = getParentSiteName(siteConfig);

  return (
    <BaseHeader
      config={siteConfig.header}
      parentSiteUrl={parentSiteUrl}
      parentSiteName={parentSiteName}
      requireLogin={siteConfig.requireLogin}
    />
  );
}
