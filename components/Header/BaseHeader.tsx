import Link from 'next/link';
import { useRouter } from 'next/router';
import Cookies from 'js-cookie';
import { logEvent } from '@/utils/client/analytics';
import { HeaderConfig } from '@/types/siteConfig';
import { isDevelopment } from '@/utils/env';

interface BaseHeaderProps {
  config: HeaderConfig;
  parentSiteUrl?: string;
  parentSiteName?: string;
  className?: string;
  logoComponent?: React.ReactNode;
  requireLogin: boolean;
}

export default function BaseHeader({
  config,
  parentSiteUrl,
  parentSiteName,
  logoComponent,
  requireLogin,
}: BaseHeaderProps) {
  const router = useRouter();
  const isActive = (pathname: string) => router.pathname === pathname;

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    await fetch('/api/logout', { method: 'POST' });
    Cookies.remove('siteAuth');
    Cookies.remove('isLoggedIn');
    router.push('/');
  };

  const handleBackToLibrary = () => {
    logEvent('click_back_to_library', 'Navigation', '');
  };

  return (
    <header className="sticky top-0 z-40 bg-white w-full">
      {isDevelopment() && (
        <div className="bg-blue-500 text-white text-center py-1 w-full">
          Dev server (site: {process.env.SITE_ID})
        </div>
      )}
      <div className="h-16 border-b border-b-slate-200 py-4 flex justify-between items-center px-4">
        {logoComponent}
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
            {config.navItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={`hover:text-slate-600 cursor-pointer ${
                  isActive(item.path) ? 'text-slate-800 font-bold' : ''
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
        {requireLogin && (
          <nav className="mr-4 pr-6 flex space-x-4">
            {Cookies.get('isLoggedIn') === 'true' ? (
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
          </nav>
        )}
      </div>
    </header>
  );
}
