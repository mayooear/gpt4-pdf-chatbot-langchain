import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Cookies from 'js-cookie';
import { logEvent } from '@/utils/client/analytics';
import { getParentSiteUrl, getParentSiteName } from '@/utils/client/siteConfig';
import Footer from './Footer';
import { SiteConfig } from '@/types/siteConfig';

interface LayoutProps {
  children?: React.ReactNode;
  siteConfig: SiteConfig | null;
}

export default function Layout({ children, siteConfig }: LayoutProps) {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isDev, setIsDev] = useState(false);
  const [isSudoUser, setIsSudoUser] = useState(false);

  useEffect(() => {
    setIsLoggedIn(Cookies.get('isLoggedIn') === 'true');
    setIsDev(process.env.NODE_ENV === 'development');
    setIsSudoUser(Cookies.get('sudo') === 'true');
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

  const parentSiteUrl = getParentSiteUrl(siteConfig);
  const parentSiteName = getParentSiteName(siteConfig);

  return (
    <div className="mx-auto flex flex-col h-screen max-w-[800px]">
      <header className="sticky top-0 z-40 bg-white w-full">
        {isDev && (
          <div className="bg-blue-500 text-white text-center py-1 w-full">
            Dev server (site: {process.env.SITE_ID})
          </div>
        )}
        <div className="h-16 border-b border-b-slate-200 py-4 flex justify-between items-center px-4">
          <nav className="ml-2 pl-1">
            <div className="space-x-10">
              {parentSiteUrl && (
                <Link
                  href={parentSiteUrl}
                  className="text-sm text-gray-500 hover:text-slate-600 cursor-pointer"
                  onClick={handleBackToLibrary}
                >
                  ← {parentSiteName}
                </Link>
              )}
              <Link
                href="/"
                className={`hover:text-slate-600 cursor-pointer ${
                  isActive('/') ? 'text-slate-800 font-bold' : ''
                }`}
              >
                Ask
              </Link>
              <Link
                href="/answers"
                className={`hover:text-slate-600 cursor-pointer ${
                  isActive('/answers') ? 'text-slate-800 font-bold' : ''
                }`}
              >
                All&nbsp;Answers
              </Link>
            </div>
          </nav>
          <nav className="mr-4 pr-6 flex space-x-4">
            {isLoggedIn ? (
              <a
                href="#"
                onClick={handleLogout}
                className="text-sm text-gray-500 hover:text-slate-600 cursor-pointer"
              >
                Logout
              </a>
            ) : (
              <Link
                href="/login"
                className="text-sm text-gray-500 hover:text-slate-600 cursor-pointer"
              >
                Login
              </Link>
            )}
            {isSudoUser && (
              <Link
                href="/admin/downvotes"
                className="text-blue-600 hover:underline"
              >
                Review Downvotes
              </Link>
            )}
          </nav>
        </div>
      </header>
      <div className="flex-grow overflow-auto main-content-wrap">
        <main className="flex flex-col h-full">{children}</main>
      </div>
      <Footer siteConfig={siteConfig} />
    </div>
  );
}
