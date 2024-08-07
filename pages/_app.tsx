import '@/styles/base.css';
import '@/styles/globals.css';
import 'react-toastify/dist/ReactToastify.css';
import type { AppProps } from 'next/app';
import { Inter } from 'next/font/google';
import { ToastContainer, toast } from 'react-toastify';
import { useEffect } from 'react';
import { initGA, logPageView, logEvent } from '@/utils/client/analytics';
import { useRouter } from 'next/router';
import { AudioProvider } from '@/contexts/AudioContext';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();

  useEffect(() => {
    const setupGA = async () => {
      if (process.env.NODE_ENV === 'production') {
        await initGA();
        logPageView(router.pathname);
      }
    };

    setupGA();

    const handleRouteChange = (url: string) => {
      if (process.env.NODE_ENV === 'production') {
        logPageView(url);
      }
    };

    router.events.on('routeChangeComplete', handleRouteChange);

    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router]);

  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      console.log('Fetch request:', args);
      console.log('Fetch response:', response);
      return response;
    };
  }, []);

  return (
    <AudioProvider>
      <main className={inter.variable}>
        <Component {...pageProps} />
      </main>
      <ToastContainer />
    </AudioProvider>
  );
}

export function reportWebVitals(metric: any) {
  if (process.env.NODE_ENV === 'production') {
    const { id, name, label, value } = metric;
    logEvent(
      name,
      label === 'web-vital' ? 'Web Vitals' : 'Next.js custom metric',
      id,
      Math.round(name === 'CLS' ? value * 1000 : value)
    );
  }
}

export default MyApp;