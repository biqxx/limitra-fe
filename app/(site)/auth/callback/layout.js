import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({ title: 'Sign-in Confirmation', noindex: true });

export default function Layout({ children }) {
  return children;
}
