import BaseHeader from './BaseHeader';
import { SiteConfig } from '@/types/siteConfig';
import { getParentSiteUrl, getParentSiteName } from '@/utils/client/siteConfig';
import Link from 'next/link';

interface AnandaHeaderProps {
  siteConfig: SiteConfig;
  isSudoUser: boolean;
  isDev: boolean;
}

export default function AnandaHeader({
  siteConfig,
  isSudoUser,
}: AnandaHeaderProps) {
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
      {isSudoUser && (
        <div className="bg-yellow-100 text-center py-1">
          <Link
            href="/admin/downvotes"
            className="text-blue-600 hover:underline"
          >
            Review Downvotes
          </Link>
        </div>
      )}
    </>
  );
}
