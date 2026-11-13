'use client';
/* LIMITRA, Affiliate program (public marketing/landing page) — ported from legacy/pages-affiliate.jsx,
   later updated to a flat per-category commission model (see lib/creatorPrograms.js) and the shared
   "Choose your Creator Program" switcher (components/pages/CreatorPrograms.jsx). */
import { Icon } from '@/components/icons/Icon';
import { useStore } from '@/components/store/StoreProvider';
import { AFFILIATE_RATES, COMMISSION_CATEGORIES, ORDERS_COUNT_YES, ORDERS_COUNT_NO } from '@/lib/creatorPrograms';
import { CreatorProgramSwitcher, CommissionTable, WhichOrdersCount, ApplySection } from '@/components/pages/CreatorPrograms';
import { affiliateApi } from '@/lib/api/endpoints';

export function AffiliatePage() {
  const scrollToApply = () => {
    const el = document.getElementById('apply');
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 90, behavior: 'smooth' });
  };

  const stats = [
    ['dollar', 'Standard', 'commission rates'],
    ['refresh', 'Rolling 90 days', 'performance window'],
    ['check', 'Delivered orders', 'count toward your rank'],
    ['spark', 'From sale #1', 'start earning commissions'],
  ];
  const steps = [
    ['user', 'Apply & get approved', 'Sign up free and get approved to start. Every affiliate commission is dependent on the listed product category commission.'],
    ['share', 'Share your links', 'Promote Limitra products to your audience via your approved referral method, bio, posts, videos, newsletter or community.'],
    ['bag', 'Drive delivered orders', 'Only valid, successfully delivered orders from genuine customers count toward your commission and rank.'],
    ['refresh', 'Earn commissions', 'Get paid for every qualifying sale made through your link. Every payment is done through Limitra.'],
  ];
  const perks = [
    ['user', 'join Affiliate', 'Earn standard commissions on every sale made through Limitra.'],
    ['refresh', 'Earn commissions', 'Get paid for every qualifying sale made through your link. Every payment is done through Limitra.'],
    ['grid', 'Real-time dashboard', 'Track clicks, delivered orders, current rank and earnings live, down to each link.'],
    ['shield', 'Valid orders protected', 'Commission is confirmed on valid delivered orders; cancelled, returned or fraudulent orders don’t count.'],
    ['gift', 'Approved creatives', 'Use Limitra-issued banners, product shots and campaign materials that stay on-brand.'],
    ['headset', 'Dedicated support', 'A partner team and clear program rules help you sell honestly and earn more.'],
  ];
  const faqs = [
    ['How is my commission rate decided?', 'Your rate is based on the number of valid delivered orders you complete within a rolling 90-day period: get commissions (commission varies with products). Everyone starts at the base category commission.'],
    ['What is the rolling 90-day window?', 'Rather than resetting quarterly, your performance is recalculated continuously using your most recent 90 days.'],
    ['Does the Affiliate have a Tier system?', 'No. Unlike MicroStores and Celebrity Stores, Affiliate commission is a flat rate set per product category, not a performance tier, so you earn the same rate from your first sale.'],
    ['When is my commission paid?', 'Commission is payable only on valid qualifying orders confirmed by Limitra. Payouts may be held for review, reconciliation, fraud screening or return checks, and Limitra sets the payout schedule, minimum threshold and approved payment channels.'],
    ['What’s the requirement for becoming an affiliate?', 'Just an approved referral channel, your Instagram, TikTok, YouTube, blog or similar, with a real, engaged audience. No minimum follower count is required to apply.'],
    ['Does it cost anything to join?', 'No. The Limitra affiliate program is completely free to join, with no fees and no obligations.'],
  ];

  return (
    <div className="page page-fade">
      {/* hero */}
      <section className="aff-hero">
        <div className="wrap aff-hero-grid">
          <div className="aff-hero-copy">
            <span className="badge badge-soft"><Icon name="spark" size={14} /> Limitra Affiliate Program</span>
            <h1>Share what you love.<br /><span className="hl">Earn while you do.</span></h1>
            <p>Turn your audience into income. Recommend Nigeria&rsquo;s favourite marketplace and earn <b>commissions</b> on valid delivered orders, your rate is calculated based on the category commission on a rolling 90-day window.</p>
            <div className="hero-cta">
              <button className="btn btn-accent btn-lg" onClick={scrollToApply}>Become an affiliate <Icon name="arrowr" size={18} /></button>
              <button className="btn btn-ghost-light btn-lg" onClick={scrollToApply}>See how it works</button>
            </div>
            <div className="aff-hero-trust">
              <span><Icon name="check" size={15} stroke={3} /> Free to join</span>
              <span><Icon name="check" size={15} stroke={3} /> Earn from sale #1</span>
              <span><Icon name="check" size={15} stroke={3} /> Up to 5%</span>
            </div>
          </div>
          <div className="aff-hero-visual">
            <img src="/assets/img/affiliate-hero.png" alt="An affiliate sharing their Limitra link, earning 1-5% commission" />
          </div>
        </div>
      </section>

      {/* stats */}
      <div className="wrap">
        <div className="aff-stats">
          {stats.map(([ic, v, l]) => (
            <div key={l} className="aff-stat">
              <span className="aff-stat-ic"><Icon name={ic} size={20} /></span>
              <div><b>{v}</b><small className="muted">{l}</small></div>
            </div>
          ))}
        </div>
      </div>

      <CreatorProgramSwitcher active="affiliate" />

      {/* how it works */}
      <section className="sec" style={{ paddingTop: 8 }}>
        <div className="wrap">
          <div className="aff-sec-head">
            <span className="eyebrow">How it works</span>
            <h2>Start earning in four simple steps</h2>
          </div>
          <div className="aff-steps">
            {steps.map(([ic, t, b], i) => (
              <div key={t} className="aff-step">
                <span className="aff-step-num">{i + 1}</span>
                <span className="aff-step-ic"><Icon name={ic} size={22} /></span>
                <b>{t}</b>
                <p className="muted">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* perks */}
      <section className="sec" style={{ paddingTop: 8 }}>
        <div className="wrap">
          <div className="aff-sec-head">
            <span className="eyebrow">Why join</span>
            <h2>Everything you need to earn more</h2>
          </div>
          <div className="aff-perks">
            {perks.map(([ic, t, b]) => (
              <div key={t} className="aff-perk card">
                <span className="aff-perk-ic"><Icon name={ic} size={20} /></span>
                <b>{t}</b>
                <p className="muted">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <WhichOrdersCount yes={ORDERS_COUNT_YES} no={ORDERS_COUNT_NO} />

      <ApplySection
        title="Become a Limitra affiliate"
        desc="Apply to join, get commissions (commission varies with products). Fill in the form to get started."
        faqs={faqs}
        apply={{
          rateNote: 'Free to join · up to 5% commission on a rolling 90-day basis.',
          codePrefix: 'LUCY',
          termsLabel: 'Affiliate',
          // Exact field names POST /affiliate/applications expects aren't
          // documented (empty request schema) — mapped from the form's own
          // fields; revisit against the first real submission's response.
          onSubmit: (f) => affiliateApi.apply({
            full_name: f.name,
            email: f.email,
            channel: f.channel,
            handle: f.handle,
            audience_size: f.audience,
            about: f.about || undefined,
          }),
        }}
      />

      <CommissionTable
        categories={COMMISSION_CATEGORIES}
        columns={['Commissions']}
        rates={AFFILIATE_RATES}
      />
    </div>
  );
}
