import type { AppProps } from 'next/app';
import '@/styles/globals.css';
import Head from 'next/head';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

// Pages that don't require login
const PUBLIC_PAGES = ['/login', '/landing'];

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  const isPublic = PUBLIC_PAGES.includes(router.pathname);

  useEffect(() => {
    if (!loading && !user && !isPublic) {
      // Redirect to landing page instead of login
      router.push('/landing');
    }
  }, [user, loading, isPublic, router]);

  // Show nothing while checking auth
  if (loading) {
    return (
      <div style={{ height: '100vh', background: '#07070d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg,#6366f1,#8b5cf6,#a855f7)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 12 }}>C</div>
          <div style={{ color: '#5a5a72', fontSize: 13 }}>Loading...</div>
        </div>
      </div>
    );
  }

  // Not logged in and not on public page
  if (!user && !isPublic) return null;

  return <>{children}</>;
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>Ceptra AI</title>
        <meta name="description" content="AI platform — code, images, docs, slides, PDFs, spreadsheets, testing, research" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="theme-color" content="#07070d" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </Head>
      <AuthProvider>
        <AuthGuard>
          <Component {...pageProps} />
        </AuthGuard>
      </AuthProvider>
    </>
  );
}
