'use client';

import { sendGAEvent } from '@next/third-parties/google';

// Add this type declaration at the top of your file
// declare global {
//   interface Window {
//     gtag: (...args: unknown[]) => void;
//     dataLayer: unknown[];
//   }
// }

export const pageview = (GA_MEASUREMENT_ID: string, url: string) => {
  console.log('logging pageview', url);
  sendGAEvent('page_view', {
    page_path: url,
    send_to: GA_MEASUREMENT_ID,
  });
};

export const logEvent = (
  action: string,
  category: string,
  label: string,
  value?: number,
) => {
  console.log('logging event', action, category, label, value);
  sendGAEvent(action, {
    event_category: category,
    event_label: label,
    value: value,
  });
};
