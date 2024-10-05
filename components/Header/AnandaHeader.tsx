import BaseHeader from './BaseHeader';
import { SiteConfig } from '@/types/siteConfig';
import { getParentSiteUrl, getParentSiteName } from '@/utils/client/siteConfig';

interface AnandaHeaderProps {
  siteConfig: SiteConfig;
}

export default function AnandaHeader({ siteConfig }: AnandaHeaderProps) {
  const parentSiteUrl = getParentSiteUrl(siteConfig);
  const parentSiteName = getParentSiteName(siteConfig);

  return (
    <>
      <BaseHeader
        config={siteConfig.header}
        parentSiteUrl={parentSiteUrl}
        parentSiteName={parentSiteName}
        requireLogin={siteConfig.requireLogin}
      />
    </>
  );
}
