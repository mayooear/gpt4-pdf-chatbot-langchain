import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Navbar from './Navbar';
import Link from 'next/link';
import Cookies from 'js-cookie';
import { logEvent } from '@/utils/client/analytics';
import Footer from './Footer';

interface LayoutProps {
  children?: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(Cookies.get('isLoggedIn') === 'true');
  }, []);

  const isActive = (pathname: string) => router.pathname === pathname;

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    await fetch('/api/logout', {
      method: 'POST',
    });
    Cookies.remove('siteAuth');
    router.push('/login');
  };

  const handleBackToLibrary = () => {
    logEvent('click_back_to_library', 'Navigation', '');
  };

  const handleHelp = () => {
    logEvent('click_help', 'Navigation', '');
  };

  return (
    <div className="mx-auto flex flex-col min-h-screen max-w-[800px]">
      <header className="sticky top-0 z-40 bg-white w-full">
        <div className="h-16 border-b border-b-slate-200 py-4 flex justify-between items-center px-4">
          <nav className="ml-2 pl-1">
            <div className="space-x-10">
              <Link href="https://www.anandalibrary.org/" className="text-sm text-gray-500 hover:text-slate-600 cursor-pointer" onClick={handleBackToLibrary}>
                ← Back to Ananda Library
              </Link>
              <Link href="/" className={`hover:text-slate-600 cursor-pointer ${isActive('/') ? 'text-slate-800 font-bold' : ''}`}>
                Ask
              </Link>
              <Link href="/answers" className={`hover:text-slate-600 cursor-pointer ${isActive('/answers') ? 'text-slate-800 font-bold' : ''}`}>
                All&nbsp;Answers
              </Link>
            </div>
          </nav>
          <nav className="mr-4 pr-6 flex space-x-4">
            <a href="https://www.anandalibrary.org/content/ai-chatbot-intro/" className="hover:text-slate-600 cursor-pointer" onClick={handleHelp}>
              Help
            </a>
            {isLoggedIn ? (
              <a href="#" onClick={handleLogout} className="hover:text-slate-600 cursor-pointer">
                Logout
              </a>
            ) : (
              <Link href="/login" className="hover:text-slate-600 cursor-pointer">
                Login
              </Link>
            )}
          </nav>
        </div>
      </header>
      <div className="flex-grow">
        <main className="flex flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
      <Footer /> 
    </div>
  );
}