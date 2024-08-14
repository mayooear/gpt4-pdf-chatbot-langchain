import React from 'react';
import Link from 'next/link';

const Footer: React.FC = () => {
  return (
    <footer className="bg-white text-gray-500 py-4 border-t border-t-slate-200">
      <div className="container mx-auto flex justify-end items-center">
        <div>
          <a
            href="https://www.anandalibrary.org/content/ai-chatbot-intro/"
            className="text-sm hover:text-slate-600 cursor-pointer mx-2"
          >
            Help
          </a>
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
