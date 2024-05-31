import { useRouter } from 'next/router';
import Navbar from './Navbar';
import Link from 'next/link';

interface LayoutProps {
  children?: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const router = useRouter();

  const isActive = (pathname: string) => router.pathname === pathname;

  return (
    // <div className="mx-auto flex flex-col space-y-4">
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
              <Link legacyBehavior href="/shared">
                <a className={`hover:text-slate-600 cursor-pointer ${isActive('/all') ? 'text-slate-800 font-bold' : ''}`}>
                  All Answers
                </a>
              </Link>
            </div>
          </nav>
          <nav className="mr-4 pr-6">
            <a href="https://www.anandalibrary.org/content/ai-chatbot-intro/" className="hover:text-slate-600 cursor-pointer">
              Help
            </a>
          </nav>
        </div>
      </header>
      <div>
        <main className="container mx-auto flex flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
