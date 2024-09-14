import '@/styles/base.css';
import '@/styles/globals.css';
import 'react-toastify/dist/ReactToastify.css';
import type { AppProps, NextWebVitalsMetric } from 'next/app';
import { Inter } from 'next/font/google';
import { ToastContainer } from 'react-toastify';
import { AudioProvider } from '@/contexts/AudioContext';
import { SiteConfig } from '@/types/siteConfig';
import { getCommonSiteConfigProps } from '@/utils/server/getCommonSiteConfigProps';
import { logEvent, pageview } from '@/utils/client/analytics';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { GoogleAnalytics } from '@next/third-parties/google';

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
    const handleRouteChange = (url: string) => {
      pageview(process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID || '', url);
    };

    router.events.on('routeChangeComplete', handleRouteChange);

    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router.events]);

  return (
    <AudioProvider>
      <main className={inter.variable}>
        <Component {...pageProps} />
        <GoogleAnalytics
          gaId={process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID || ''}
          dataLayerName="dataLayer"
        />
      </main>
      <ToastContainer />
    </AudioProvider>
  );
}

MyApp.getInitialProps = async () => {
  const result = await getCommonSiteConfigProps();
  return { pageProps: result.props };
};

export function reportWebVitals(metric: NextWebVitalsMetric) {
  const { id, name, label, value } = metric;
  logEvent(
    name,
    label === 'web-vital' ? 'Web Vitals' : 'Next.js custom metric',
    id,
    Math.round(name === 'CLS' ? value * 1000 : value),
  );
}

export default MyApp;
