import '@/styles/base.css';
import '@/styles/globals.css';
import 'react-toastify/dist/ReactToastify.css';
import type { AppProps, AppContext } from 'next/app';
import { Inter } from 'next/font/google';
import { ToastContainer } from 'react-toastify';
import { useEffect } from 'react';
import {
  initGoogleAnalytics,
  logPageView,
  logEvent,
} from '@/utils/client/analytics';
import { useRouter } from 'next/router';
import { AudioProvider } from '@/contexts/AudioContext';
import { SiteConfig } from '@/types/siteConfig';
import { getCommonSiteConfigProps } from '@/utils/server/getCommonSiteConfigProps';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

interface CustomAppProps extends AppProps {
  pageProps: {
    siteConfig: SiteConfig | null;
  };
}

function MyApp({ Component, pageProps }: CustomAppProps) {
  const router = useRouter();

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      initGoogleAnalytics();
      logPageView(router.pathname);
    }

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

  return (
    <AudioProvider>
      <main className={inter.variable}>
        <Component {...pageProps} />
      </main>
      <ToastContainer />
    </AudioProvider>
  );
}

MyApp.getInitialProps = async (appContext: AppContext) => {
  const ctx = appContext.ctx;
  const result = await getCommonSiteConfigProps(ctx);

  return { pageProps: result.props };
};

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
