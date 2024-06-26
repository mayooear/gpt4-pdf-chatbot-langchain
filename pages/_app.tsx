import '@/styles/base.css';
import '@/styles/globals.css';
import 'react-toastify/dist/ReactToastify.css';
import type { AppProps } from 'next/app';
import { Inter } from 'next/font/google';
import { ToastContainer, toast } from 'react-toastify';
import { useEffect } from 'react';
import { initGA, logPageView } from '@/utils/client/analytics';
import { useRouter } from 'next/router';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();

  useEffect(() => {
    const setupGA = async () => {
      await initGA();
      logPageView(router.pathname);
    };

    setupGA();

    const handleRouteChange = (url: string) => {
      logPageView(url);
    };

    router.events.on('routeChangeComplete', handleRouteChange);

    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router]);

  return (
    <>
      <main className={inter.variable}>
        <Component {...pageProps} />
      </main>
      <ToastContainer />
    </>
  );
}

export default MyApp;