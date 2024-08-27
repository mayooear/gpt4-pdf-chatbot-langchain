import '@/styles/base.css';
import '@/styles/globals.css';
import 'react-toastify/dist/ReactToastify.css';
import type { AppProps } from 'next/app';
import { Inter } from 'next/font/google';
import { ToastContainer, toast } from 'react-toastify';
import { useEffect, useState } from 'react';
import {
  initGoogleAnalytics,
  logPageView,
  logEvent,
} from '@/utils/client/analytics';
import { useRouter } from 'next/router';
import { AudioProvider } from '@/contexts/AudioContext';
import { SiteConfig } from '@/utils/client/siteConfig';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [siteConfig, setSiteConfig] = useState<SiteConfig | null>(null);
  const [showLoading, setShowLoading] = useState(false);

  const setupApp = async () => {
    if (process.env.NODE_ENV === 'production') {
      await initGoogleAnalytics();
      logPageView(router.pathname);
    }

    // Fetch site config
    try {
      const response = await fetch('/api/siteConfig');
      if (!response.ok) {
        throw new Error('Failed to fetch site config');
      }
      const config = await response.json();
      setSiteConfig(config);
    } catch (error) {
      console.error('Error fetching site config:', error);
      toast.error('Failed to load site configuration');
    }
  };

  useEffect(() => {
    setupApp();

    const handleRouteChange = (url: string) => {
      if (process.env.NODE_ENV === 'production') {
        logPageView(url);
      }
    };

    router.events.on('routeChangeComplete', handleRouteChange);

    // Set a timer to show loading message after 3.5 seconds
    const timer = setTimeout(() => {
      setShowLoading(true);
    }, 3500);

    // Clear the timer if siteConfig is loaded before 3.5 seconds
    return () => {
      clearTimeout(timer);
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router]);

  if (!siteConfig) {
    return showLoading ? <div>Loading...</div> : null;
  }

  return (
    <AudioProvider>
      <main className={inter.variable}>
        <Component {...pageProps} siteConfig={siteConfig} />
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
      Math.round(name === 'CLS' ? value * 1000 : value),
    );
  }
}

export default MyApp;
