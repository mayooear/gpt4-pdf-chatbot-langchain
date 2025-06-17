import { useSession, signIn, signOut } from 'next-auth/react';
import Link from 'next/link'; // Import Link for navigation

interface LayoutProps {
  children?: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { data: session, status } = useSession();
  const loading = status === 'loading';

  return (
    <div className="mx-auto flex flex-col space-y-4">
      <header className="container sticky top-0 z-40 bg-white">
        <div className="h-16 border-b border-b-slate-200 py-4 flex justify-between items-center">
          <nav className="ml-4 pl-6 flex items-center space-x-4">
            <Link href="/" legacyBehavior>
              <a className="hover:text-slate-600 cursor-pointer">
                Home
              </a>
            </Link>
            {session?.user?.role === 'Admin' && (
              <Link href="/admin/upload" legacyBehavior>
                <a className="hover:text-slate-600 cursor-pointer">
                  Admin Upload
                </a>
              </Link>
            )}
          </nav>
          <div className="mr-4 pr-6">
            {loading && <p>Loading...</p>}
            {!loading && !session && (
              <button
                onClick={() => signIn('google')}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Sign In with Google
              </button>
            )}
            {!loading && session && (
              <div className="flex items-center space-x-2">
                <p>
                  {session.user?.name || session.user?.email} ({session.user?.role})
                </p>
                <button
                  onClick={() => signOut()}
                  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <div>
        <main className="flex w-full flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
