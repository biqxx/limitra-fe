import { ProductPage } from '@/components/pages/ProductPage';
import {
  JsonLd,
  SITE_NAME,
  buildMetadata,
  canonicalUrl,
  fetchApiJson,
  truncateText,
} from '@/lib/seo';

function extractImageUrls(product) {
  if (!Array.isArray(product?.images)) return [];
  return product.images
    .map((img) => (typeof img === 'string' ? img : img?.url || img?.path))
    .filter((src) => typeof src === 'string' && src.trim().length > 0);
}

async function getProduct(id) {
  if (!id) return null;
  return fetchApiJson(`/products/${encodeURIComponent(id)}`, { revalidate: 300 });
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const product = await getProduct(id);

  if (!product) {
    return buildMetadata({
      title: 'Product Details',
      description: 'Explore curated products on Limitra with fast nationwide delivery.',
      path: `/product/${encodeURIComponent(id)}`,
    });
  }

  const slugOrId = product.slug || product.id || id;
  const seoMeta = product.seo_meta && typeof product.seo_meta === 'object' ? product.seo_meta : {};
  const title =
    seoMeta.title ||
    (product.brand ? `${product.name} — ${product.brand}` : product.name);

  const priceNum = Number(product.price);
  const priceLabel = Number.isFinite(priceNum) && priceNum > 0
    ? `₦${priceNum.toLocaleString('en-NG')}`
    : '';
  const rawDesc =
    seoMeta.description ||
    product.description ||
    [product.name, product.brand, product.category?.name, priceLabel]
      .filter(Boolean)
      .join(' · ');
  const description =
    truncateText(rawDesc, 160) ||
    `Buy ${product.name} on ${SITE_NAME} with verified quality and nationwide delivery.`;

  const images = extractImageUrls(product);
  const keywords = Array.isArray(seoMeta.keywords)
    ? seoMeta.keywords
    : [product.name, product.brand, product.category?.name, product.subcategory?.name, SITE_NAME].filter(Boolean);

  return buildMetadata({
    title,
    description,
    path: `/product/${encodeURIComponent(slugOrId)}`,
    images,
    keywords,
  });
}

export default async function ProductRoutePage({ params }) {
  const { id } = await params;
  const product = await getProduct(id);

  let jsonLd = null;
  if (product) {
    const slugOrId = product.slug || product.id || id;
    const productUrl = canonicalUrl(`/product/${encodeURIComponent(slugOrId)}`);
    const images = extractImageUrls(product);
    const price = Number(product.price);
    const reviewCount = Number(product.review_count ?? product.reviews_count ?? 0);
    const ratingValue = Number(product.average_rating ?? product.rating ?? 0);

    const productSchema = {
      '@type': 'Product',
      name: product.name,
      url: productUrl,
      ...(images.length > 0 ? { image: images } : {}),
      ...(product.description ? { description: truncateText(product.description, 500) } : {}),
      ...(product.sku ? { sku: product.sku } : {}),
      ...(product.brand ? { brand: { '@type': 'Brand', name: product.brand } } : {}),
      ...(product.category?.name ? { category: product.category.name } : {}),
      offers: {
        '@type': 'Offer',
        url: productUrl,
        priceCurrency: product.currency || 'NGN',
        price: Number.isFinite(price) ? price.toFixed(2) : '0.00',
        availability:
          Number(product.stock) > 0 || product.in_stock
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
        itemCondition: 'https://schema.org/NewCondition',
      },
      ...(reviewCount > 0 && ratingValue > 0
        ? {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: Number(ratingValue.toFixed(1)),
              reviewCount,
            },
          }
        : {}),
    };

    const breadcrumbItems = [
      { '@type': 'ListItem', position: 1, name: 'Home', item: canonicalUrl('/') },
      { '@type': 'ListItem', position: 2, name: 'Shop', item: canonicalUrl('/shop/all') },
    ];
    if (product.category?.slug && product.category?.name) {
      breadcrumbItems.push({
        '@type': 'ListItem',
        position: breadcrumbItems.length + 1,
        name: product.category.name,
        item: canonicalUrl(`/shop/${encodeURIComponent(product.category.slug)}`),
      });
    }
    if (product.subcategory?.slug && product.subcategory?.name && product.category?.slug) {
      breadcrumbItems.push({
        '@type': 'ListItem',
        position: breadcrumbItems.length + 1,
        name: product.subcategory.name,
        item: canonicalUrl(
          `/shop/${encodeURIComponent(product.category.slug)}/${encodeURIComponent(product.subcategory.slug)}`
        ),
      });
    }
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: breadcrumbItems.length + 1,
      name: product.name,
      item: productUrl,
    });

    jsonLd = {
      '@context': 'https://schema.org',
      '@graph': [
        productSchema,
        {
          '@type': 'BreadcrumbList',
          itemListElement: breadcrumbItems,
        },
      ],
    };
  }

  return (
    <>
      <JsonLd data={jsonLd} />
      <ProductPage id={id} />
    </>
  );
}
