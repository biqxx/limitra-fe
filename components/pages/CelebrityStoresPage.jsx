'use client';
/* LIMITRA, Celebrity Stores (public marketing/landing page) — the third of the three
   "creator program" pages (see AffiliatePage.jsx, MicroStoresPage.jsx). There is no
   celebrity-store backend yet (same situation as MicroStores — see lib/microstoresData.js),
   so "Featured Celebrity Stores" below reuses the MicroStores demo data and its storefront
   route rather than inventing a second, parallel demo dataset. */
import { Icon } from '@/components/icons/Icon';
import { useStore } from '@/components/store/StoreProvider';
import { Placeholder } from '@/components/ui/Shared';
import { MICROSTORES } from '@/lib/microstoresData';
import { CELEBRITY_TIERS, CELEBRITY_RATES, COMMISSION_CATEGORIES, STORE_ADVANTAGE, ORDERS_COUNT_YES, ORDERS_COUNT_NO } from '@/lib/creatorPrograms';
import { CreatorProgramSwitcher, PerformanceTierBlock, CommissionTable, WhichOrdersCount, ApplySection } from '@/components/pages/CreatorPrograms';

const CS_STEPS = [
  ['store', 'Create your store', 'Pick a name and claim your unique, shareable store URL in seconds.'],
  ['cart', 'Choose products', 'Pick from millions of products across every category on Limitra.'],
  ['share', 'Share your store', 'Share one link on WhatsApp, TikTok, Instagram & more.'],
  ['dollar', 'Earn', 'Get paid out when your orders are successfully delivered.'],
];

const FEATURED_STORES = MICROSTORES.slice(0, 4);

const FAQS = [
  ['How is my commission rate decided?', 'Your rate is based on your qualifying sales within a rolling 90-day period: Celebrity Partner, Premium Celebrity Partner or Celebrity Icon Partner, with the category commission applying on top. Everyone starts at the Celebrity Partner rate.'],
  ['What is the rolling 90-day window?', 'Rather than resetting quarterly, your performance is recalculated continuously using your most recent 90 days. Your tier can move up when you hit the next threshold, or down if recent activity falls below it.'],
  ['Which orders count toward my rank and earnings?', 'Only valid, successfully delivered orders from genuine customers through your approved storefront. Cancelled, refunded, returned, failed, duplicate, self-referred or fraudulent orders do not count and may be reversed.'],
  ['When is my commission paid?', 'Commission is payable only on valid qualifying orders confirmed by Limitra. Payouts may be held for review, reconciliation, fraud screening or return checks.'],
  ['Can my rank go down or my account be removed?', 'Yes. Tier is not permanent, it adjusts automatically with your rolling 90-day results. Limitra may also pause or remove partners for fraud, impersonation or other policy violations.'],
  ['Does it cost anything to join?', 'No. Applying for a Celebrity Store is free. Celebrity Stores are a selective, invite-and-apply program, not every application is approved.'],
];

export function CelebrityStoresPage() {
  const { go } = useStore();
  const scrollToApply = () => {
    const el = document.getElementById('apply');
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 90, behavior: 'smooth' });
  };

  return (
    <div className="page page-fade">
      {/* hero */}
      <section className="aff-hero">
        <div className="wrap aff-hero-grid">
          <div className="aff-hero-copy">
            <span className="badge badge-soft"><Icon name="star" size={14} /> Limitra Celebrity Stores</span>
            <h1>Shop Your Favourite<br /><span className="hl">Celebrity&rsquo;s Picks</span></h1>
            <p>Discover exclusive collections curated by your favourite celebrities and creators. Shop what they love, all in one place.</p>
            <div className="hero-cta">
              <button className="btn btn-accent btn-lg" onClick={scrollToApply}>Become a Celebrity Store Partner <Icon name="arrowr" size={18} /></button>
              <button className="btn btn-ghost-light btn-lg" onClick={scrollToApply}>See how it works</button>
            </div>
            <div className="aff-hero-trust">
              <span><Icon name="check" size={15} stroke={3} /> Higher rates</span>
              <span><Icon name="check" size={15} stroke={3} /> Rolling 90 days</span>
              <span><Icon name="check" size={15} stroke={3} /> From sale #1</span>
            </div>
          </div>
          <div className="aff-hero-card">
            <div className="ahc-top">
              <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>Featured partner store</span>
              <span className="status-pill ok">Verified</span>
            </div>
            <div className="ahc-amount" style={{ fontSize: 26 }}>Jay&rsquo;s Picks</div>
            <div className="ahc-bars">
              {[55, 70, 48, 82, 64, 90, 100].map((h, i) => <span key={i} style={{ height: h + '%' }} className={i === 6 ? 'on' : ''} />)}
            </div>
            <div className="ahc-rows">
              <div className="ahc-row"><span className="ahc-ic"><Icon name="bag" size={15} /></span><div><b>Premium Celebrity Partner</b><small className="muted">Current tier</small></div><b className="ahc-val ok">Rank up</b></div>
              <div className="ahc-row"><span className="ahc-ic"><Icon name="user" size={15} /></span><div><b>284,000 followers</b><small className="muted">Verified audience</small></div><b className="ahc-val">Icon soon</b></div>
            </div>
          </div>
        </div>
      </section>

      <CreatorProgramSwitcher active="celebrity" />

      {/* advantage */}
      <section className="sec" style={{ paddingTop: 8 }}>
        <div className="wrap">
          <div className="aff-sec-head" style={{ maxWidth: 680 }}>
            <span className="eyebrow">The Celebrity Store advantage</span>
            <h2>More than commissions. It&rsquo;s your brand.</h2>
            <p className="muted" style={{ marginTop: 10, textWrap: 'pretty' }}>With Limitra Celebrity Stores, you get the tools, support and flexibility to turn your audience into a thriving online business. Not just a link.</p>
          </div>
          <div className="aff-perks" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
            {STORE_ADVANTAGE.map(([ic, t, b]) => (
              <div key={t} className="aff-perk card">
                <span className="aff-perk-ic"><Icon name={ic} size={20} /></span>
                <b>{t}</b>
                <p className="muted">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PerformanceTierBlock tiers={CELEBRITY_TIERS} />

      {/* how it works */}
      <section className="sec" style={{ paddingTop: 8 }}>
        <div className="wrap">
          <div className="aff-sec-head">
            <span className="eyebrow">How it works</span>
            <h2>From idea to income in four steps</h2>
          </div>
          <div className="aff-steps">
            {CS_STEPS.map(([ic, t, b], i) => (
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

      {/* featured celebrity stores */}
      <section className="sec" id="featured-stores">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <div className="eyebrow">Explore</div>
              <h2>Featured Celebrity Stores</h2>
            </div>
            <a className="see-all" onClick={() => go('microstoresExplore')} style={{ cursor: 'pointer' }}>Explore <Icon name="arrowr" size={15} /></a>
          </div>
          <div className="ms-stores">
            {FEATURED_STORES.map(s => (
              <div key={s.slug} className="ms-store-card card">
                <div className="ms-store-head">
                  <span className="ms-store-avatar" style={{ background: s.color }}><Icon name="star" size={18} /></span>
                  <div><b>{s.name}</b><small>limitra.com.ng/{s.slug}</small></div>
                </div>
                <div className="ms-store-thumbs">
                  {s.products.slice(0, 4).map(p => <div key={p.id} className="ms-store-thumb"><Placeholder label={p.name.split(' ')[0]} product={{ tint: p.tint }} /></div>)}
                </div>
                <button className="btn btn-outline btn-sm btn-block" onClick={() => go('microstore', s.slug)}>View Store <Icon name="arrowr" size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CommissionTable
        title="Celebrity Store commission rates"
        desc="You earn a percentage of the sales you generate with rates based on the product category and your current partner tier."
        categories={COMMISSION_CATEGORIES}
        columns={['Celebrity Partner', 'Premium Partner', 'Icon Partner']}
        rates={CELEBRITY_RATES}
      />

      <WhichOrdersCount yes={ORDERS_COUNT_YES} no={ORDERS_COUNT_NO} />

      <ApplySection
        title="Become a Celebrity Store Partner"
        desc="Apply to join. Start at the current category commission on your first valid delivered sale, and climb the tiers as your rolling 90-day performance grows. Fill in the form to get started."
        faqs={FAQS}
        apply={{
          rateNote: 'Free to join · commissions on a rolling 90-day basis.',
          codePrefix: 'STAR',
          termsLabel: 'Celebrity Store',
          successBody: 'Celebrity Stores are a selective program — our partner team will review your application and reach out if approved.',
        }}
      />

      {/* final cta */}
      <section className="sec">
        <div className="wrap">
          <div className="ms-cta">
            <h2>Ready to be Limitra&rsquo;s next Celebrity Partner?</h2>
            <p>It takes a few minutes to apply. Limitra handles inventory, pricing, checkout, fulfillment and returns — you just share your link and earn.</p>
            <button className="btn btn-lg" style={{ background: '#fff', color: 'var(--orange)' }} onClick={scrollToApply}>Become a Celebrity Store Partner <Icon name="arrowr" size={18} /></button>
          </div>
        </div>
      </section>
    </div>
  );
}
