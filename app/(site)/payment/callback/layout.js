import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({ title: 'Payment Confirmation', noindex: true });

export default function Layout({ children }) {
  return children;
}
