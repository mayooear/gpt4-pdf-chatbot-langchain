import '@/styles/base.css';
import '@/styles/globals.css';
import 'react-toastify/dist/ReactToastify.css';
import type { AppProps, NextWebVitalsMetric } from 'next/app';
import { GoogleAnalytics, event } from 'nextjs-google-analytics';
import { Inter } from 'next/font/google';
import { ToastContainer } from 'react-toastify';
import { AudioProvider } from '@/contexts/AudioContext';
import { SudoProvider } from '@/contexts/SudoContext';
import { SiteConfig } from '@/types/siteConfig';
import { getCommonSiteConfigProps } from '@/utils/server/getCommonSiteConfigProps';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

interface CustomAppProps extends AppProps {
  pageProps: {
    siteConfig: SiteConfig | null;
  };
}

function MyApp({ Component, pageProps }: CustomAppProps) {
  const isDevelopment = process.env.NODE_ENV === 'development';

  return (
    <SudoProvider>
      <AudioProvider>
        <main className={inter.className}>
          {!isDevelopment && <GoogleAnalytics trackPageViews />}
          <Component {...pageProps} />
        </main>
        <ToastContainer />
      </AudioProvider>
    </SudoProvider>
  );
}

MyApp.getInitialProps = async () => {
  const result = await getCommonSiteConfigProps();
  return { pageProps: result.props };
};

export function reportWebVitals(metric: NextWebVitalsMetric) {
  const { id, name, label, value } = metric;
  if (process.env.NODE_ENV === 'development') {
    console.log(
      'Not logging web vitals event in dev mode:',
      name,
      label,
      id,
      value,
    );
  } else {
    event(name, {
      category: label === 'web-vital' ? 'Web Vitals' : 'Next.js custom metric',
      value: Math.round(name === 'CLS' ? value * 1000 : value), // values must be integers
      label: id, // id unique to current page load
      nonInteraction: true, // avoids affecting bounce rate.
    });
  }
}

export default MyApp;
