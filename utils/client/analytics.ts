// Google Analytics

export const initGA = () => {
  window.gtag('js', new Date());
  window.gtag('config', 'YOUR_GA_MEASUREMENT_ID');
};

export const logEvent = (action: string, category: string, label: string, value?: number) => {
  window.gtag('event', action, {
    'event_category': category,
    'event_label': label,
    'value': value
  });
};

// Add this type declaration at the top of your file
declare global {
  interface Window {
    gtag: (command: string, ...args: any[]) => void;
  }
}
