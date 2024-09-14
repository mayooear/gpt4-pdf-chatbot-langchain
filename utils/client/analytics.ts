'use client';

import { event } from 'nextjs-google-analytics';

export const logEvent = (
  action: string,
  category: string,
  label: string,
  value?: number,
) => {
  event(action, {
    category: category,
    label: label,
    value: value,
  });
};
