import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({ title: 'Staff Invitation', noindex: true });

export default function Layout({ children }) {
  return children;
}
