'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { contentApi } from '@/lib/api/endpoints';
import { Breadcrumbs } from '@/components/ui/Shared';

export function BlogPostClient({ slug, initialPost = null }) {
  const [post, setPost] = useState(initialPost);
  const [loaded, setLoaded] = useState(Boolean(initialPost));

  useEffect(() => {
    if (!slug) return;
    contentApi.blogPost(slug)
      .then((res) => setPost(res?.post || res))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [slug]);

  return (
    <div className="page page-fade">
      <div className="wrap" style={{ maxWidth: 780 }}>
        <Breadcrumbs items={[{ label: 'Home', to: ['home'] }, { label: 'Blog', href: '/blog' }, { label: post?.title || 'Article' }]} />
        {!loaded ? (
          <p className="muted" style={{ padding: '40px 0' }}>Loading article…</p>
        ) : !post ? (
          <div style={{ padding: '48px 0' }}>
            <h2>Article not found</h2>
            <Link href="/blog" className="btn btn-primary btn-sm" style={{ marginTop: 14 }}>Back to Blog</Link>
          </div>
        ) : (
          <article style={{ padding: '20px 0 48px' }}>
            <h1 style={{ fontSize: 32, marginBottom: 12 }}>{post.title}</h1>
            {post.excerpt && <p className="muted" style={{ fontSize: 16, marginBottom: 24 }}>{post.excerpt}</p>}
            <div style={{ lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>{post.body || post.content || ''}</div>
          </article>
        )}
      </div>
    </div>
  );
}

