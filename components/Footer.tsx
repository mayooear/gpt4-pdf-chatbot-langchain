import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-white text-gray-200 py-4 border-t border-t-slate-200">
      <div className="container mx-auto flex justify-end items-center">
        <div>
          <a href="https://github.com/anandaworldwide/ananda-library-chatbot" className="text-blue-400 hover:underline mx-2">Open Source Project</a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;