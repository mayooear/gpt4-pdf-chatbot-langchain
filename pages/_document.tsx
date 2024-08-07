import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  const cspContent = process.env.NODE_ENV === 'development'
    ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data:; connect-src 'self'; media-src 'self' https://ananda-chatbot.s3.us-west-1.amazonaws.com; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://youtu.be"
    : "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com; connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' https://www.google-analytics.com https://www.googletagmanager.com data:; media-src 'self' https://ananda-chatbot.s3.us-west-1.amazonaws.com blob:; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://youtu.be";

  return (
    <Html lang="en">
      <Head>
        <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />
        <meta httpEquiv="Content-Security-Policy" content={cspContent} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}