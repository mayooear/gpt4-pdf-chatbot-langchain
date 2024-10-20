import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { SiteConfig } from '@/types/siteConfig';
import { getParentSiteUrl } from '@/utils/client/siteConfig';

interface CrystalHeaderProps {
  siteConfig: SiteConfig;
}

export default function CrystalHeader({ siteConfig }: CrystalHeaderProps) {
  const parentSiteUrl = getParentSiteUrl(siteConfig);

  return (
    <header className="sticky top-0 z-40 w-full bg-[#0092e3] text-white">
      <div className="h-24 flex justify-between items-center px-4">
        <div className="flex items-center">
          <Link href="/">
            <Image
              src="https://www.crystalclarity.com/cdn/shop/files/logo-white.png?v=1671755975&width=382"
              alt="Crystal Clarity Publishers"
              width={267}
              height={43}
              sizes="(max-width: 210px) 210px, 267px"
              className="header__logo-image cursor-pointer"
              priority
            />
          </Link>
        </div>
        <Link href={parentSiteUrl} className="text-base hover:underline">
          Back to Main Site &gt;
        </Link>
      </div>
    </header>
  );
}
