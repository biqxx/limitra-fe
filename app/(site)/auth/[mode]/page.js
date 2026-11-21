import { AuthPage } from '@/components/pages/AuthPage';
import { buildMetadata } from '@/lib/seo';

export async function generateMetadata({ params }) {
  const { mode } = await params;
  const label = mode === 'signup' ? 'Create Account' : 'Sign In';
  return buildMetadata({
    title: label,
    description: `${label} to your Limitra account.`,
    path: `/auth/${encodeURIComponent(mode || 'signin')}`,
    noindex: true,
  });
}

export default async function AuthModePage({ params }) {
  const { mode } = await params;
  return <AuthPage mode={mode || 'signin'} />;
}
