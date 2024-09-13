import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';

  const cspContent = `default-src 'self' ${baseUrl};
    script-src 'self' ${baseUrl} 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com;
    connect-src 'self' ${baseUrl} https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com;
    style-src 'self' ${baseUrl} 'unsafe-inline' https://fonts.googleapis.com;
    font-src 'self' ${baseUrl} https://fonts.gstatic.com data:;
    img-src 'self' ${baseUrl} https://www.google-analytics.com https://www.googletagmanager.com data:;
    media-src 'self' ${baseUrl} https://ananda-chatbot.s3.us-west-1.amazonaws.com blob:;
    frame-src 'self' ${baseUrl} https://www.youtube.com https://www.youtube-nocookie.com https://youtu.be`;

  return (
    <Html lang="en">
      <Head>
        <link
          href="https://fonts.googleapis.com/icon?family=Material+Icons"
          rel="stylesheet"
        />
        <meta httpEquiv="Content-Security-Policy" content={cspContent} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
