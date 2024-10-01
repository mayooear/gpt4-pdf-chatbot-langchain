import React from 'react';
import Image from 'next/image';
import BaseHeader from './BaseHeader';
import { SiteConfig } from '@/types/siteConfig';
import { getParentSiteUrl, getParentSiteName } from '@/utils/client/siteConfig';

interface CrystalHeaderProps {
  siteConfig: SiteConfig;
  isSudoUser: boolean;
  isDev: boolean;
}

export default function CrystalHeader({ siteConfig }: CrystalHeaderProps) {
  const parentSiteUrl = getParentSiteUrl(siteConfig);
  const parentSiteName = getParentSiteName(siteConfig);

  const logoComponent = (
    <div className="flex items-center">
      <Image
        src="https://www.crystalclarity.com/cdn/shop/files/logo-white.png?v=1671755975&width=382"
        alt="Crystal Clarity Publishers"
        width={382}
        height={61}
        sizes="(max-width: 300px) 300px, 382px"
        className="header__logo-image"
        priority
      />
    </div>
  );

  return (
    <BaseHeader
      config={siteConfig.header}
      parentSiteUrl={parentSiteUrl}
      parentSiteName={parentSiteName}
      className="bg-gradient-radial from-[#ffffff40] via-[#0092e340] to-[#0092e3] text-white h-24"
      logoComponent={logoComponent}
      requireLogin={siteConfig.requireLogin}
    />
  );
}
