// Google Analytics
import { isDevelopment } from '@/utils/env';

// Add this type declaration at the top of your file
declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
  }
}

let isInitialized = false;

const isAnalyticsDisabled = () => {
  return isDevelopment();
};

export const initGoogleAnalytics = () => {
  console.log('Attempting to initialize Google Analytics');
  console.log('Environment:', process.env.NODE_ENV);

  if (isAnalyticsDisabled()) {
    console.log('Analytics disabled: Skipping GA initialization');
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    if (isInitialized) {
      console.log('Google Analytics already initialized');
      resolve();
      return;
    }

    console.log('Creating Google Analytics script');
    const script = document.createElement('script');
    script.src = `https://www.googletagmanager.com/gtag/js?id=G-9551DZXPEZ`;
    script.async = true;

    script.onload = () => {
      console.log('Google Analytics script loaded successfully');
      window.dataLayer = window.dataLayer || [];
      window.gtag = function gtag(...args: unknown[]) {
        window.dataLayer.push(args);
      };
      window.gtag('js', new Date());
      window.gtag('config', 'G-9551DZXPEZ');
      isInitialized = true;
      console.log('Google Analytics initialized');
      resolve();
    };

    script.onerror = (error) => {
      console.error('Failed to load GA script:', error);
      console.error('Script src:', script.src);
      console.error('Navigator online status:', navigator.onLine);
      console.error('Document readyState:', document.readyState);
      resolve(); // Resolve the promise to prevent hanging
    };

    // Check if the script can be added to the document
    try {
      document.head.appendChild(script);
      console.log('Google Analytics script appended to head');
    } catch (error) {
      console.error('Error appending GA script to head:', error);
      resolve(); // Resolve the promise to prevent hanging
    }
  });
};

export const logPageView = (url: string) => {
  if (isAnalyticsDisabled()) {
    console.log(`Analytics disabled: Skipping logPageView for URL: ${url}`);
    return;
  }

  console.log(`Attempting to log page view for URL: ${url}`);
  if (typeof window.gtag === 'function') {
    window.gtag('config', 'G-9551DZXPEZ', {
      page_path: url,
    });
    console.log(`Page view logged for URL: ${url}`);
  } else {
    console.error('window.gtag is not a function');
  }
};

export const logEvent = async (
  action: string,
  category: string,
  label: string,
  value?: number,
) => {
  if (isAnalyticsDisabled()) {
    console.log(
      `Analytics disabled: Skipping logEvent for action: ${action}, category: ${category}, label: ${label}, value: ${value}`,
    );
    return;
  }

  console.log(`Attempting to log event: ${action}, ${category}, ${label}, ${value}`);
  if (!isInitialized) {
    await initGoogleAnalytics();
  }

  if (typeof window.gtag === 'function') {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    });
    console.log(`Event logged: ${action}, ${category}, ${label}, ${value}`);
  } else {
    console.error('window.gtag is not a function');
  }
};
