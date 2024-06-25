import { useRouter } from 'next/router';
import Navbar from './Navbar';
import Link from 'next/link';
import Cookies from 'js-cookie';

interface LayoutProps {
  children?: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const router = useRouter();

  const isActive = (pathname: string) => router.pathname === pathname;

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    await fetch('/api/logout', {
      method: 'POST',
    });
    Cookies.remove('siteAuth');
    router.push('/login');
  };

  return (
    <div className="mx-auto flex flex-col min-h-screen">
      <header className="container mx-auto sticky top-0 z-40 bg-white">
        <div className="h-16 border-b border-b-slate-200 py-4 flex justify-between items-center">
          <nav className="ml-2 pl-1">
            <div className="space-x-10">
              <a href="https://www.anandalibrary.org/" className="text-sm text-gray-500 hover:text-slate-600 cursor-pointer">
                ← Back to Ananda Library
              </a>
              <Link legacyBehavior href="/">
                <a className={`hover:text-slate-600 cursor-pointer ${isActive('/') ? 'text-slate-800 font-bold' : ''}`}>
                  Ask
                </a>
              </Link>
              <Link legacyBehavior href="/all">
                <a className={`hover:text-slate-600 cursor-pointer ${isActive('/all') ? 'text-slate-800 font-bold' : ''}`}>
                  All&nbsp;Answers
                </a>
              </Link>
            </div>
          </nav>
          <nav className="mr-4 pr-6 flex space-x-4">
            <a href="https://www.anandalibrary.org/content/ai-chatbot-intro/" className="hover:text-slate-600 cursor-pointer">
              Help
            </a>
            <a href="#" onClick={handleLogout} className="hover:text-slate-600 cursor-pointer">
              Logout
            </a>
          </nav>
        </div>
      </header>
      <div className="flex-grow">
        <main className="container mx-auto flex flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
      <footer className="container mx-auto py-4 text-center text-sm text-gray-500">
        <Link href="/stats" className="hover:text-slate-600">
          Site Statistics
        </Link>
      </footer>
    </div>
  );
}