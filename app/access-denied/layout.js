import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({ title: 'Access Denied', noindex: true });

export default function Layout({ children }) {
  return children;
}
