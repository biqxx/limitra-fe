import { SITE_URL } from '@/lib/seo';

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/admin/',
          '/affiliate/dashboard',
          '/affiliate/dashboard/',
          '/microstore/dashboard',
          '/microstore/dashboard/',
          '/account',
          '/account/',
          '/auth',
          '/auth/',
          '/cart',
          '/checkout',
          '/orders',
          '/wishlist',
          '/shared-wishlist/',
          '/payment/',
          '/staff/',
          '/access-denied',
          '/tracking/',
          '/newsletter/',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}

