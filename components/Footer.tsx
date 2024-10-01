import React from 'react';
import Link from 'next/link';
import { SiteConfig } from '@/types/siteConfig';
import { getFooterConfig } from '@/utils/client/siteConfig';

interface FooterProps {
  siteConfig: SiteConfig | null;
}

const Footer: React.FC<FooterProps> = ({ siteConfig }) => {
  const footerConfig = getFooterConfig(siteConfig);

  return (
    <footer className="bg-white text-gray-500 py-4 border-t border-t-slate-200">
      <div className="container mx-auto flex justify-center items-center">
        <div className="flex flex-wrap justify-center items-center">
          {footerConfig.links.map((link, index) => {
            const content = (
              <>
                {link.label}
                {link.icon && (
                  <span
                    className="material-icons ml-1 align-middle"
                    style={{ fontFamily: "'Material Icons'" }}
                  >
                    {link.icon}
                  </span>
                )}
              </>
            );

            if (!link.url) {
              return (
                <span
                  key={index}
                  className="text-sm mx-2 my-1 inline-flex items-center"
                >
                  {content}
                </span>
              );
            }

            const isExternal =
              link.url.startsWith('http') || link.url.startsWith('//');

            if (isExternal) {
              return (
                <a
                  key={index}
                  href={link.url}
                  className="text-sm hover:text-slate-600 cursor-pointer mx-2 my-1 inline-flex items-center"
                >
                  {content}
                </a>
              );
            } else {
              return (
                <Link
                  key={index}
                  href={link.url}
                  className="text-sm hover:text-slate-600 cursor-pointer mx-2 my-1 inline-flex items-center"
                >
                  {content}
                </Link>
              );
            }
          })}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
