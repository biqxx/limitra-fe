import { Suspense } from 'react';
import { Quicksand } from 'next/font/google';
import '@/styles/styles.css';
import TopProgressBar from '@/components/ui/TopProgressBar';

const quicksand = Quicksand({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-quicksand',
  display: 'swap',
});

export const metadata = {
  title: 'Limitra, Premium Tech Marketplace',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={quicksand.variable}>
      <body>
        <Suspense fallback={null}>
          <TopProgressBar />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
