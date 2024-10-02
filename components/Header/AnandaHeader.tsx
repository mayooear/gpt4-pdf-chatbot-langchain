import BaseHeader from './BaseHeader';
import { SiteConfig } from '@/types/siteConfig';
import { getParentSiteUrl, getParentSiteName } from '@/utils/client/siteConfig';
import Cookies from 'js-cookie';
import Link from 'next/link';

interface AnandaHeaderProps {
  siteConfig: SiteConfig;
}

export default function AnandaHeader({ siteConfig }: AnandaHeaderProps) {
  const parentSiteUrl = getParentSiteUrl(siteConfig);
  const parentSiteName = getParentSiteName(siteConfig);
  const isSudoUser = Cookies.get('sudo') === 'true';

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
