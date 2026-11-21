'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { contentApi } from '@/lib/api/endpoints';
import { Breadcrumbs, EmptyState } from '@/components/ui/Shared';

export function BlogIndexClient() {
  const [posts, setPosts] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    contentApi.blogPosts({ per_page: 24 })
      .then((res) => setPosts(Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : []))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  return (
    <div className="page page-fade">
      <div className="wrap">
        <Breadcrumbs items={[{ label: 'Home', to: ['home'] }, { label: 'Blog' }]} />
        <div style={{ margin: '18px 0 28px' }}>
          <h1>Limitra Journal</h1>
          <p className="muted">Stories, buying guides, and creator spotlights.</p>
        </div>
        {!loaded ? (
          <p className="muted">Loading articles…</p>
        ) : posts.length === 0 ? (
          <EmptyState icon="edit" title="No blog posts yet" body="Check back soon for new guides and stories." />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
            {posts.map((p) => (
              <Link key={p.id || p.slug} href={`/blog/${p.slug || p.id}`} className="card" style={{ padding: 20, display: 'block', textDecoration: 'none', color: 'inherit' }}>
                <b style={{ fontSize: 17, display: 'block', marginBottom: 8 }}>{p.title}</b>
                {p.excerpt && <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.5 }}>{p.excerpt}</p>}
                <span className="link-btn" style={{ marginTop: 12, display: 'inline-block' }}>Read article →</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

