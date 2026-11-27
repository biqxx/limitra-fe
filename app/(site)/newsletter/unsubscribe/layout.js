import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({ title: 'Newsletter Unsubscribe', noindex: true });

export default function Layout({ children }) {
  return children;
}
