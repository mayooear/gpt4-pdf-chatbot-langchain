// Footer component for the application
import React from 'react';
import Link from 'next/link';
import { SiteConfig } from '@/types/siteConfig';
import { getFooterConfig } from '@/utils/client/siteConfig';
import { useSudo } from '@/contexts/SudoContext';

interface FooterProps {
  siteConfig: SiteConfig | null;
}

const Footer: React.FC<FooterProps> = ({ siteConfig }) => {
  const { isSudoUser } = useSudo();
  const footerConfig = getFooterConfig(siteConfig);

  return (
    <>
      {/* Admin section for sudo users */}
      {isSudoUser && (
        <div className="bg-gray-100 text-gray-700 py-2 border-t border-t-slate-200 mt-4">
          <div className="container mx-auto flex justify-center items-center">
            <b>ADMIN:</b>
            {!siteConfig?.allowAllAnswersPage && (
              <Link
                href="/answers"
                className="text-sm hover:text-slate-600 cursor-pointer mx-2 flex items-center"
              >
                All Answers
                <span className="material-icons text-sm ml-1">list_alt</span>
              </Link>
            )}
            <Link
              href="/admin/downvotes"
              className="text-sm hover:text-slate-600 cursor-pointer mx-2 flex items-center"
            >
              Review Downvotes
              <span className="material-icons text-sm ml-1">thumb_down</span>
            </Link>
            <Link
              href="/bless"
              className="text-sm hover:text-slate-600 cursor-pointer mx-2 flex items-center"
            >
              Manage Blessing
              <span className="material-icons text-sm ml-1">auto_fix_high</span>
            </Link>
            {!siteConfig?.enableModelComparison && (
              <Link
                href="/compare-models"
                className="text-sm hover:text-slate-600 cursor-pointer mx-2 flex items-center"
              >
                Compare Models
                <span className="material-icons text-sm ml-1">compare</span>
              </Link>
            )}
          </div>
        </div>
      )}
      {/* Main footer section */}
      <footer className="bg-white text-gray-500 py-4 border-t border-t-slate-200">
        <div className="container mx-auto flex justify-center items-center">
          <div className="flex flex-wrap justify-center items-center">
            {footerConfig.links.map((link, index) => {
              // Add default icons if not specified in config
              let icon = link.icon;
              if (!icon) {
                switch (link.label.toLowerCase()) {
                  case 'help':
                    icon = 'help_outline';
                    break;
                  case 'contact':
                    icon = 'mail_outline';
                    break;
                  case 'open source':
                  case 'open source project':
                    icon = 'code';
                    break;
                  case 'compare ai models':
                    icon = 'compare';
                    break;
                }
              }

              const content = (
                <>
                  {link.label}
                  {icon && (
                    <span className="material-icons text-sm ml-1">{icon}</span>
                  )}
                </>
              );

              // Render non-clickable text
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

              // Render external link
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
                // Render internal link
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
    </>
  );
};

export default Footer;
