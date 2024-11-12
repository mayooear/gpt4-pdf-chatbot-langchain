// Custom Document component for Next.js
import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Include Material Icons font */}
        <link
          href="https://fonts.googleapis.com/icon?family=Material+Icons"
          rel="stylesheet"
        />
        {/* Add Apple Touch Icon */}
        <link 
          rel="apple-touch-icon" 
          sizes="180x180" 
          href="/apple-touch-icon.png"
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
