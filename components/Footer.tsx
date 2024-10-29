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
                className="text-sm hover:text-slate-600 cursor-pointer mx-2"
              >
                All Answers
              </Link>
            )}
            <Link
              href="/admin/downvotes"
              className="text-sm hover:text-slate-600 cursor-pointer mx-2"
            >
              Review Downvotes
            </Link>
            <Link
              href="/bless"
              className="text-sm hover:text-slate-600 cursor-pointer mx-2"
            >
              Manage Blessing
            </Link>
            <Link
              href="/admin/model-comparison"
              className="text-sm hover:text-slate-600 cursor-pointer mx-2"
            >
              Model Comparison
            </Link>
          </div>
        </div>
      )}
      {/* Main footer section */}
      <footer className="bg-white text-gray-500 py-4 border-t border-t-slate-200">
        <div className="container mx-auto flex justify-center items-center">
          <div className="flex flex-wrap justify-center items-center">
            {/* Render footer links */}
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
