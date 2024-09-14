'use client';

import { event } from 'nextjs-google-analytics';

export const logEvent = (
  action: string,
  category: string,
  label: string,
  value?: number,
) => {
  console.log('logging event', action, category, label, value);
  event(action, {
    category: category,
    label: label,
    value: value,
  });
};
