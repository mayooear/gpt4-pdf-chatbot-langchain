// Custom Document component for Next.js
import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  // Define the Content Security Policy (CSP)
  const cspContent = `
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com https://www.googletagmanager.com https://www.google-analytics.com;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    font-src 'self' https://fonts.gstatic.com;
    img-src 'self' data:;
    connect-src 'self';
    frame-src 'self';
  `.replace(/\s{2,}/g, ' ').trim();

  return (
    <Html lang="en">
      <Head>
        {/* Apply the Content Security Policy */}
        <meta httpEquiv="Content-Security-Policy" content={cspContent} />

        {/* Include Material Icons font */}
        <link
          href="https://fonts.googleapis.com/icon?family=Material+Icons"
          rel="stylesheet"
        />
      </Head>
      <body>
        {/* Main content will be injected here */}
        <Main />
        {/* Next.js scripts */}
        <NextScript />
      </body>
    </Html>
  );
}
