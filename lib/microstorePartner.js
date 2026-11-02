/* Demo data for the signed-in MicroStore Partner dashboard (app/microstores/dashboard/*).
   Same situation as lib/microstoresData.js — there is no MicroStore/partner backend yet, so
   this is illustrative content only, reusing the 'megagaming' demo store from that file as
   "my store" and the same Chidinma Okeke persona the Affiliate dashboard (components/affiliate/
   Affiliate.jsx) already uses, since in this demo world one creator can be both an affiliate
   and a MicroStore Partner. */
import { storeBySlug } from './microstoresData';

const MY_STORE = storeBySlug('megagaming');
const PARTNER = { name: 'Chidinma Okeke', firstName: 'Chidinma', initials: 'CO', email: 'chidinma@email.com' };

const MS_ORDERS = [
  { id: 'ORD-1042', customer: 'July H.', items: 10, date: '11 Jun 2026', total: 20000, status: 'Processing' },
  { id: 'ORD-1041', customer: 'Ahmed O.', items: 4, date: '11 Jun 2026', total: 20000, status: 'Cancelled' },
  { id: 'ORD-1040', customer: 'Emmanuel O.', items: 6, date: '10 Jun 2026', total: 20000, status: 'Processing' },
  { id: 'ORD-1039', customer: 'Roxy A.', items: 3, date: '10 Jun 2026', total: 20000, status: 'Shipped' },
  { id: 'ORD-1038', customer: 'Dexy A.', items: 10, date: '09 Jun 2026', total: 20000, status: 'Delivered' },
  { id: 'ORD-1037', customer: 'Blessing N.', items: 2, date: '08 Jun 2026', total: 64900, status: 'Delivered' },
  { id: 'ORD-1036', customer: 'Kunle S.', items: 1, date: '07 Jun 2026', total: 48500, status: 'Delivered' },
  { id: 'ORD-1035', customer: 'Tobi A.', items: 5, date: '06 Jun 2026', total: 22000, status: 'Delivered' },
  { id: 'ORD-1034', customer: 'Grace N.', items: 1, date: '05 Jun 2026', total: 35500, status: 'Delivered' },
  { id: 'ORD-1033', customer: 'Yusuf M.', items: 2, date: '04 Jun 2026', total: 29900, status: 'Delivered' },
  { id: 'ORD-1032', customer: 'Sade O.', items: 1, date: '02 Jun 2026', total: 12000, status: 'Delivered' },
  { id: 'ORD-1031', customer: 'Chuka E.', items: 3, date: '01 Jun 2026', total: 64900, status: 'Cancelled' },
];

const MS_ORDER_STATUS = [
  { label: 'Delivered', v: 30, c: '#1F8A5B' },
  { label: 'Processing', v: 8, c: '#0438B6' },
  { label: 'Shipped', v: 3, c: '#F5A623' },
  { label: 'Cancelled', v: 1, c: '#E5484D' },
];

const MS_SALES_SERIES = {
  '3D': { labels: ['Sep 3', 'Sep 4', 'Sep 5', 'Sep 6', 'Sep 7', 'Sep 8', 'Sep 9'], data: [18500, 24200, 19800, 29000, 31500, 26800, 34900] },
  '30D': { labels: ['W1', 'W2', 'W3', 'W4'], data: [86000, 94500, 71200, 112800] },
  '10M': { labels: ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'], data: [142000, 168000, 155000, 189000, 174000, 201000, 196000, 223000, 215000, 248500] },
  '1Y': { labels: ['Q1', 'Q2', 'Q3', 'Q4'], data: [412000, 486000, 521000, 589000] },
};

const MS_TOP_PRODUCTS = [
  { name: 'Classic Oversized Tee', sold: 42, revenue: 120000 },
  { name: 'Classic Gaming Headset', sold: 34, revenue: 2206600 },
  { name: 'Pro Gaming Mouse', sold: 29, revenue: 638000 },
  { name: 'Console Controller', sold: 22, revenue: 657800 },
];

const MS_CUSTOMERS = [
  { name: 'Dexy A.', email: 'dexy.a@email.com', orders: 6, spent: 248500 },
  { name: 'Blessing N.', email: 'blessing.n@email.com', orders: 4, spent: 186200 },
  { name: 'Tobi A.', email: 'tobi.a@email.com', orders: 3, spent: 94500 },
  { name: 'Grace N.', email: 'grace.n@email.com', orders: 3, spent: 71200 },
  { name: 'Kunle S.', email: 'kunle.s@email.com', orders: 2, spent: 68400 },
  { name: 'Yusuf M.', email: 'yusuf.m@email.com', orders: 2, spent: 59800 },
  { name: 'Sade O.', email: 'sade.o@email.com', orders: 1, spent: 12000 },
];

const MS_REVIEWS = [
  { product: 'Classic Gaming Headset', customer: 'Dexy A.', rating: 5, date: '09 Jun 2026', comment: 'Great sound quality and super comfortable for long sessions.' },
  { product: 'Pro Gaming Mouse', customer: 'Blessing N.', rating: 4, date: '07 Jun 2026', comment: 'Works well, a bit light for my taste but good value.' },
  { product: 'Console Controller', customer: 'Kunle S.', rating: 5, date: '05 Jun 2026', comment: 'Exactly as described, fast delivery too.' },
  { product: 'Mechanical Keyboard RGB', customer: 'Tobi A.', rating: 3, date: '02 Jun 2026', comment: 'Good keyboard but the RGB app could be better.' },
];

const MS_TRANSACTIONS = [
  { desc: 'Sale, order ORD-1038', date: '09 Jun 2026', amount: 20000, status: 'Paid' },
  { desc: 'Sale, order ORD-1037', date: '08 Jun 2026', amount: 64900, status: 'Paid' },
  { desc: 'Withdrawal to GTBank ••4821', date: '06 Jun 2026', amount: -50000, status: 'Paid' },
  { desc: 'Sale, order ORD-1036', date: '07 Jun 2026', amount: 48500, status: 'Pending' },
  { desc: 'Platform fee, May', date: '01 Jun 2026', amount: -4200, status: 'Paid' },
  { desc: 'Sale, order ORD-1035', date: '06 Jun 2026', amount: 22000, status: 'Paid' },
];

const MS_WITHDRAWALS = [
  { date: '06 Jun 2026', amount: 50000, method: 'Bank Transfer', status: 'Paid' },
  { date: '18 May 2026', amount: 72000, method: 'Bank Transfer', status: 'Paid' },
];

export {
  MY_STORE, PARTNER,
  MS_ORDERS, MS_ORDER_STATUS, MS_SALES_SERIES, MS_TOP_PRODUCTS,
  MS_CUSTOMERS, MS_REVIEWS, MS_TRANSACTIONS, MS_WITHDRAWALS,
};
