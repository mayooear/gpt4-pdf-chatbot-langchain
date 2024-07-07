// Google Analytics
import { isDevelopment } from '@/utils/env';

// Add this type declaration at the top of your file
declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}

let isInitialized = false;

export const initGA = () => {
  return new Promise<void>((resolve) => {
    if (isInitialized) {
      console.log('GA already initialized');
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://www.googletagmanager.com/gtag/js?id=G-9551DZXPEZ`;
    script.async = true;
    
    script.onload = () => {
      console.log('GA script loaded successfully');
      window.dataLayer = window.dataLayer || [];
      window.gtag = function gtag() {
        window.dataLayer.push(arguments);
      };
      window.gtag('js', new Date());
      window.gtag('config', 'G-9551DZXPEZ');
      isInitialized = true;
      resolve();
    };

    script.onerror = (error) => {
      console.error('Failed to load GA script:', error);
      console.error('Script src:', script.src);
      resolve();
    };

    document.head.appendChild(script);
    console.log('GA script appended to head');
  });
};

export const logPageView = (url: string) => {
  if (typeof window.gtag === 'function') {
    window.gtag('config', 'G-9551DZXPEZ', {
      page_path: url,
    });
  }
};

export const logEvent = async (action: string, category: string, label: string, value?: number) => {

  if (isDevelopment()) {
    console.log(`Development mode: Skipping logEvent for action: ${action}, category: ${category}, label: ${label}, value: ${value}`);
    return;
  }

  if (!isInitialized) {
    await initGA();
  }
  
  if (typeof window.gtag === 'function') {
    window.gtag('event', action, {
      'event_category': category,
      'event_label': label,
      'value': value
    });
  }
};