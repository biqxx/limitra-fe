/* Shared config for Limitra's three "creator program" marketing pages
   (Affiliate, MicroStores, Celebrity Stores) — illustrative rates and tiers only,
   there is no commission/program backend yet (see lib/microstoresData.js for the
   same situation on the MicroStores directory/storefront pages). Centralized here
   so the three landing pages (AffiliatePage.jsx, MicroStoresPage.jsx,
   CelebrityStoresPage.jsx) stay numerically consistent with each other and with
   the shared "Choose your Creator Program" switcher in CreatorPrograms.jsx. */

export const CREATOR_PROGRAMS = [
  {
    key: 'affiliate', route: 'affiliate', icon: 'share',
    name: 'Affiliate Program', tagline: 'Share Products, Earn Commissions',
    desc: 'Recommend Limitra products to your audience and earn commissions on every order made through your link.',
    minValue: '500+', minSub: 'Followers',
    bullets: ['Free entry', 'Standard commission on every sale', 'No minimum sales required', 'No performance review'],
    cta: 'Apply to become an Affiliate', footer: 'Accessible. Simple. Rewarding.',
  },
  {
    key: 'microstores', route: 'microstores', icon: 'store',
    name: 'MicroStores', tagline: 'Your Store. Your Audience. Your Earnings',
    desc: 'Turn your influence into your own branded online store. No inventory, no stress, just your audience and your unique store.',
    minValue: '10,000+', minSub: 'Followers',
    bullets: ['Application and approval required', 'Personalized online storefront', 'Rank up every 90 days', 'Access to creator tools'],
    cta: 'Apply for a MicroStore', footer: 'Build. Grow.',
  },
  {
    key: 'celebrity', route: 'celebrityStores', icon: 'star',
    name: 'Celebrity Stores', tagline: 'Your Influence. Your Brand. Your Store',
    desc: 'Bring your personal brand to Limitra with a premium storefront, exclusive opportunities and dedicated support.',
    minValue: '200,000+', minSub: 'Followers',
    bullets: ['Selective application & approval', 'Premium storefront experience', 'Higher commission tiers', 'Dedicated partner support'],
    cta: 'Apply for a Celebrity Store', footer: 'More Reach. More Impact. More Earnings.',
  },
];

export const COMMISSION_CATEGORIES = [
  'Phones and tablets',
  'Electronics and accesories',
  'Beauty and personal care',
  'Fashion and Clothing',
  'Home appliances',
  'Baby products',
  'Automotive spare parts',
  'Selected high-margin products',
];

/* Affiliate: flat per-category rate, no performance tiers. */
export const AFFILIATE_RATES = {
  'Phones and tablets': '1%',
  'Electronics and accesories': '2%',
  'Beauty and personal care': '5%',
  'Fashion and Clothing': '5%',
  'Home appliances': '3%',
  'Baby products': '3%',
  'Automotive spare parts': '2%',
  'Selected high-margin products': '5%',
};

/* MicroStores: rate scales with a rolling-90-day qualifying-sales tier. */
export const MICROSTORE_TIERS = [
  { key: 'creator', name: 'Creator', range: '₦0 – ₦25,000,000', sub: 'Standard Creator Commission', sub2: 'Access to creator tools', featured: false },
  { key: 'pro', name: 'Pro Creator', range: '₦25,000,000 – ₦99,999,999', sub: 'More than Creator Commission', sub2: 'Access to creator tools', featured: true, tag: 'Most common' },
  { key: 'elite', name: 'Elite Creator', range: '₦100,000,000+', sub: 'More than Pro Commission', sub2: 'Access to creator tools', featured: false },
];
export const MICROSTORE_RATES = {
  'Phones and tablets': ['1%', '1.25%', '1.5%'],
  'Electronics and accesories': ['2%', '2.5%', '3%'],
  'Beauty and personal care': ['5%', '5.5%', '6%'],
  'Fashion and Clothing': ['3%', '3.5%', '4%'],
  'Home appliances': ['3%', '3.5%', '4%'],
  'Baby products': ['3%', '3.5%', '4%'],
  'Automotive spare parts': ['2%', '2.5%', '3%'],
  'Selected high-margin products': ['5%', '6%', 'Up to 7%'],
};

/* Celebrity Stores: same tier mechanic as MicroStores, higher rates at every band. */
export const CELEBRITY_TIERS = [
  { key: 'celebrity', name: 'Celebrity Partner', range: '₦0 – ₦25,000,000', sub: 'Standard rate within tier', sub2: 'Access to creator tools', featured: false },
  { key: 'premium', name: 'Premium Celebrity Partner', range: '₦25,000,000 – ₦99,999,999', sub: 'More than Creator Commission', sub2: 'Access to creator tools', featured: true, tag: 'Most common' },
  { key: 'icon', name: 'Celebrity Icon Partner', range: '₦100,000,000+', sub: 'More than Pro Commission', sub2: 'Access to creator tools', featured: false },
];
export const CELEBRITY_RATES = {
  'Phones and tablets': ['1.25%', '1.5%', '1.75%'],
  'Electronics and accesories': ['2.5%', '3%', '3.5%'],
  'Beauty and personal care': ['5.5%', '6%', '6.5%'],
  'Fashion and Clothing': ['3.5%', '4%', '4.5%'],
  'Home appliances': ['3.5%', '4%', '4.5%'],
  'Baby products': ['3.5%', '4%', '4.5%'],
  'Automotive spare parts': ['3%', '3.5%', '4%'],
  'Selected high-margin products': ['6%', '7%', '7.5%'],
};

/* "More than commissions. It's your brand." perks — shared by MicroStores and
   Celebrity Stores (both are storefront-based programs; Affiliate has its own
   link-sharing-focused perks list instead). */
export const STORE_ADVANTAGE = [
  ['grid', 'Curate Your Own Products', 'Curate products from Limitra’s approved catalog that match your audience.'],
  ['store', 'Branded Storefront', 'Get your own store URL and customizable store design.'],
  ['spark', 'AI Marketing Tools', 'Create content, generate visuals and get campaign ideas with AI.'],
  ['grid', 'Sales Dashboard', 'Track your performance, commissions and customer insights live.'],
  ['headset', 'Dedicated Support', 'Get help from dedicated teams for support.'],
];

export const ORDERS_COUNT_YES = [
  'Delivered orders that are successfully completed',
  'Paid orders that pass Limitra review as valid',
  'Orders from genuine customers via your approved referral method',
];
export const ORDERS_COUNT_NO = [
  'Cancelled, refunded, returned or failed-delivery orders',
  'Duplicate orders or self-referrals to inflate your tier',
  'Fraudulent, misleading or otherwise invalid transactions',
];
