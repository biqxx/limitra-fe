'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { contentApi } from '@/lib/api/endpoints';
import { Breadcrumbs } from '@/components/ui/Shared';

export default function CmsContentPage() {
  const { slug } = useParams();
  const [entry, setEntry] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!slug) return;
    contentApi.page(slug)
      .then((res) => setEntry(res?.entry || res))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [slug]);

  return (
    <div className="page page-fade">
      <div className="wrap" style={{ maxWidth: 820 }}>
        <Breadcrumbs items={[{ label: 'Home', to: ['home'] }, { label: entry?.title || slug }]} />
        {!loaded ? (
          <p className="muted" style={{ padding: '40px 0' }}>Loading page…</p>
        ) : !entry ? (
          <div style={{ padding: '48px 0' }}><h2>Page not found</h2></div>
        ) : (
          <article style={{ padding: '20px 0 48px' }}>
            <h1 style={{ fontSize: 30, marginBottom: 16 }}>{entry.title}</h1>
            <div style={{ lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
              {typeof entry.body === 'string' ? entry.body : JSON.stringify(entry.body || '', null, 2)}
            </div>
          </article>
        )}
      </div>
    </div>
  );
}

