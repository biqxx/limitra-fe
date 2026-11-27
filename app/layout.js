import { Suspense } from 'react';
import { Quicksand } from 'next/font/google';
import '@/styles/styles.css';
import TopProgressBar from '@/components/ui/TopProgressBar';
import { DEFAULT_DESCRIPTION, JsonLd, SITE_NAME, SITE_URL } from '@/lib/seo';

const quicksand = Quicksand({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-quicksand',
  display: 'swap',
});

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Premium Marketplace`,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,

};

const SITE_GRAPH_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
      logo: SITE_URL + '/assets/logo.png',
    },
    {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,

    },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en-NG" className={quicksand.variable}>
      <body>
        <JsonLd data={SITE_GRAPH_LD} />
        <Suspense fallback={null}>
          <TopProgressBar />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
