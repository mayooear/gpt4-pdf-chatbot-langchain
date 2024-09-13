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
let initializationPromise: Promise<void> | null = null;

const getGoogleAnalyticsId = () => {
  const id = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID;
  console.log('Google Analytics ID:', id);
  return id;
};

const isAnalyticsDisabled = () => {
  const disabled = isDevelopment();
  console.log('Analytics disabled:', disabled);
  return disabled;
};

const isGABlocked = () => {
  return typeof window === 'undefined' || (!window.gtag && !window.dataLayer);
};

export const initGoogleAnalytics = () => {
  console.log('Attempting to initialize Google Analytics');
  console.log('Environment:', process.env.NODE_ENV);

  if (isAnalyticsDisabled()) {
    console.log('Analytics disabled: Skipping GA initialization');
    return Promise.resolve();
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = new Promise<void>((resolve) => {
    if (isInitialized) {
      console.log('Google Analytics already initialized');
      resolve();
      return;
    }

    const gaId = getGoogleAnalyticsId();
    console.log(`Creating Google Analytics script for ID: ${gaId}`);
    const script = document.createElement('script');
    script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
    script.async = true;

    script.onload = () => {
      console.log('Google Analytics script loaded successfully');
      window.dataLayer = window.dataLayer || [];
      function gtag(...args: unknown[]) {
        window.dataLayer.push(args);
      }
      window.gtag = gtag;
      window.gtag('js', new Date());
      window.gtag('config', gaId);
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

  if (isGABlocked()) {
    console.warn('Google Analytics appears to be blocked.');
    return Promise.resolve();
  }

  return initializationPromise;
};

export const logPageView = async (url: string) => {
  if (isAnalyticsDisabled()) {
    console.log(`Analytics disabled: Skipping logPageView for URL: ${url}`);
    return;
  }

  console.log(`Attempting to log page view for URL: ${url}`);
  await initGoogleAnalytics();

  if (typeof window.gtag === 'function') {
    window.gtag('config', getGoogleAnalyticsId(), {
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

  console.log(
    `Attempting to log event: ${action}, ${category}, ${label}, ${value}`,
  );

  await initGoogleAnalytics();

  if (typeof window.gtag === 'function') {
    try {
      window.gtag('event', action, {
        event_category: category,
        event_label: label,
        value: value,
      });
      console.log(`Event logged: ${action}, ${category}, ${label}, ${value}`);
    } catch (error) {
      console.error('Error logging event:', error);
    }
  } else {
    console.warn('Google Analytics not available. Event not logged.');
    console.log('window.gtag:', window.gtag);
    console.log('window.dataLayer:', window.dataLayer);
  }
};
