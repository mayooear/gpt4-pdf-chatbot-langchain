import React from 'react';
import Link from 'next/link';
import { SiteConfig } from '@/types/siteConfig';

interface FooterProps {
  siteConfig: SiteConfig | null;
}

const Footer: React.FC<FooterProps> = ({ siteConfig }) => {
  return (
    <footer className="bg-white text-gray-500 py-4 border-t border-t-slate-200">
      <div className="container mx-auto flex justify-end items-center">
        <div>
          {siteConfig && siteConfig.help_url && (
            <a
              href={siteConfig.help_url}
              className="text-sm hover:text-slate-600 cursor-pointer mx-2"
            >
              {siteConfig.help_text || 'Help'}
            </a>
          )}
          <Link
            href="/contact"
            className="text-sm hover:text-slate-600 cursor-pointer mx-2"
          >
            Contact
          </Link>
          <a
            href="https://github.com/anandaworldwide/ananda-library-chatbot"
            className="text-sm hover:text-slate-600 cursor-pointer mx-2"
          >
            Open Source
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
