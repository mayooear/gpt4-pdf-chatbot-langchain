'use client';

import { event } from 'nextjs-google-analytics';

export const logEvent = (
  action: string,
  category: string,
  label: string,
  value?: number,
) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(
      'skipping logEvent in dev mode',
      action,
      category,
      label,
      value,
    );
  } else {
    event(action, {
      category: category,
      label: label,
      value: value,
    });
  }
};
