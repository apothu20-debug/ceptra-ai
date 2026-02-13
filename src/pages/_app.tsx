import type { AppProps } from 'next/app';
import '@/styles/globals.css';
import Head from 'next/head';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>Ceptra AI</title>
        <meta name="description" content="AI platform — code, images, docs, slides, PDFs, spreadsheets, testing, research" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
