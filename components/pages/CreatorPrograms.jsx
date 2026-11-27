'use client';
/* Shared building blocks for Limitra's three "creator program" marketing pages
   (AffiliatePage.jsx, MicroStoresPage.jsx, CelebrityStoresPage.jsx) — the
   program-switcher cards, the 90-day performance-tier block, the per-category
   commission-rate table, the "which orders count" block, and the apply
   form + FAQ section. Keeping these in one place means the three pages stay
   visually and numerically consistent instead of drifting copies. */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon, Logo } from '@/components/icons/Icon';
import { useStore } from '@/components/store/StoreProvider';
import { affiliateApi, myMicrostoreApi, myCelebrityStoreApi } from '@/lib/api/endpoints';
import { messageFrom } from '@/lib/api/errors';
import { CREATOR_PROGRAMS } from '@/lib/creatorPrograms';

export function CreatorProgramSwitcher({ active }) {
  const { go } = useStore();
  return (
    <section className="sec" style={{ paddingBottom: 8 }}>
      <div className="wrap">
        <div className="aff-sec-head">
          <span className="eyebrow">Three ways to earn, one Limitra</span>
          <h2>Choose your <span className="hl">Creator Program</span></h2>
          <p className="muted" style={{ marginTop: 10, textWrap: 'pretty' }}>Whether you are sharing products, building your own store or have a massive audience, there&rsquo;s a place for you.</p>
        </div>
        <div className="cp-switch">
          {CREATOR_PROGRAMS.map(p => (
            <div key={p.key} className={'cp-card card' + (active === p.key ? ' on' : '') + (p.dark ? ' dark' : '')}>
              <img className="cp-card-photo" src={p.photo} alt="" aria-hidden="true" style={p.photoPosition ? { objectPosition: p.photoPosition } : undefined} />
              <div className="cp-card-head">
                <Logo height={18} white={p.dark} />
                <b>{p.name}</b>
                <small>{p.tagline}</small>
              </div>
              <p className="cp-card-desc">{p.desc}</p>
              {p.ribbon && <span className="cp-card-ribbon">{p.ribbon}</span>}
              <div className="cp-card-stats">
                <div className="cp-card-min"><Icon name="user" size={18} /><div><small>Minimum</small><b>{p.minValue}</b><small>{p.minSub}</small></div></div>
                <ul className="cp-card-list">
                  {p.bullets.map(b => <li key={b}><Icon name="check" size={13} stroke={3} /> {b}</li>)}
                </ul>
              </div>
              <button className="btn btn-accent btn-block btn-sm" onClick={() => go(p.route)}>{p.cta} <Icon name="arrowr" size={14} /></button>
              <span className="cp-card-foot">{p.footer}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PerformanceTierBlock({ eyebrow = 'Your performance, every 90 days', title = 'Every 90 Days Is a New Opportunity to Grow', desc, tiers }) {
  return (
    <section className="sec" style={{ paddingTop: 8 }}>
      <div className="wrap">
        <div className="aff-sec-head">
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
          {desc && <p className="muted" style={{ marginTop: 10, textWrap: 'pretty' }}>{desc}</p>}
        </div>
        <div className={'aff-tiers' + (tiers.length === 5 ? ' five' : '')}>
          {tiers.map(t => (
            <div key={t.key} className={'aff-tier card' + (t.featured ? ' featured' : '')}>
              {t.tag && <span className="aff-tier-tag">{t.tag}</span>}
              <span className="aff-tier-name">{t.name}</span>
              <span className="aff-tier-range" style={{ marginTop: 10 }}><b>{t.range}</b><small>Qualifying sales / 90 days</small></span>
              <p className="muted aff-tier-sub">{t.sub}{t.sub2 && <><br />{t.sub2}</>}</p>
            </div>
          ))}
        </div>
        <p className="muted" style={{ textAlign: 'center', marginTop: 22, fontSize: 13.5, maxWidth: 640, marginInline: 'auto', textWrap: 'pretty' }}>
          It&rsquo;s a rolling 90-day window. Your qualifying sales are continually evaluated based on the most recent 90 days, not fixed calendar quarters. You can qualify for an upgrade as soon as your usage meets the next tier&rsquo;s threshold and is verified.
        </p>
      </div>
    </section>
  );
}

export function CommissionTable({ title = 'Different products. Different rates.', desc = 'You earn a percentage of the sales you generate with rates based on the product category.', categories, columns, rates }) {
  return (
    <section className="sec" style={{ paddingTop: 8 }}>
      <div className="wrap">
        <div className="cp-rate-card card">
          <span className="eyebrow">Commission rates by product category</span>
          <h2 style={{ marginTop: 6 }}>{title}</h2>
          <p className="muted" style={{ marginTop: 8, marginBottom: 20, textWrap: 'pretty' }}>{desc} All commissions are subject to product-level profitability checks.</p>
          <div className="cp-rate-table-wrap">
            <table className="cp-rate-table">
              <thead>
                <tr><th>Product Category</th>{columns.map(c => <th key={c}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {categories.map(cat => {
                  const r = rates[cat];
                  const vals = Array.isArray(r) ? r : [r];
                  return <tr key={cat}><td>{cat}</td>{vals.map((v, i) => <td key={i}>{v}</td>)}</tr>;
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

export function WhichOrdersCount({ yes, no }) {
  return (
    <section className="sec" style={{ paddingTop: 8 }}>
      <div className="wrap">
        <div className="aff-sec-head">
          <span className="eyebrow">Fair & transparent</span>
          <h2>Which orders count</h2>
        </div>
        <div className="aff-counts">
          <div className="count-card card yes">
            <div className="count-head"><span className="count-ic ok"><Icon name="check" size={18} stroke={3} /></span><b>Orders that count</b></div>
            <ul>{yes.map(c => <li key={c}><Icon name="check" size={16} stroke={3} /> {c}</li>)}</ul>
          </div>
          <div className="count-card card no">
            <div className="count-head"><span className="count-ic bad"><Icon name="close" size={18} stroke={3} /></span><b>Orders that don&rsquo;t count</b></div>
            <ul>{no.map(c => <li key={c}><Icon name="close" size={16} stroke={2.5} /> {c}</li>)}</ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function CreatorField({ label, value, onChange, err, placeholder, type = 'text', full }) {
  return (
    <div className="field" style={{ gridColumn: full ? '1 / -1' : 'auto' }}>
      <label>{label}</label>
      <input className={'input' + (err ? ' err' : '')} type={type} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
      {err && <span className="err-msg">{err}</span>}
    </div>
  );
}

function MicrostoreQuickCreate() {
  const { go, toast } = useStore();
  const [f, setF] = useState({ name: '', tagline: '' });
  const [err, setErr] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [store, setStore] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!f.name.trim()) { setErr('Enter a store name'); return; }
    setErr('');
    setSubmitting(true);
    try {
      const res = await myMicrostoreApi.create({ name: f.name.trim(), tagline: f.tagline.trim() || undefined });
      setStore(res?.microstore || res);
      toast('MicroStore created!');
    } catch (err2) {
      toast(messageFrom(err2, 'Could not create your MicroStore'));
    } finally {
      setSubmitting(false);
    }
  };

  if (store) {
    const slug = store.slug;
    return (
      <div className="aff-success card">
        <div className="success-check" style={{ width: 64, height: 64, marginBottom: 16 }}><Icon name="check" size={30} stroke={3} /></div>
        <h3 style={{ fontSize: 22 }}>Your MicroStore is live!</h3>
        {slug && <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => go('microstore', slug)}>View my storefront</button>}
      </div>
    );
  }

  return (
    <form className="aff-form card" onSubmit={submit}>
      <h3 style={{ fontSize: 22, marginBottom: 4 }}>Create your MicroStore</h3>
      <p className="muted" style={{ fontSize: 14, marginBottom: 20 }}>You&rsquo;re signed in — set up your storefront in one step.</p>
      <div className="form-grid">
        <CreatorField label="Store name" full value={f.name} onChange={(v) => setF((s) => ({ ...s, name: v }))} err={err} placeholder="Lucy's Picks" />
        <CreatorField label="Tagline (optional)" full value={f.tagline} onChange={(v) => setF((s) => ({ ...s, tagline: v }))} placeholder="Curated tech & lifestyle finds" />
      </div>
      <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={submitting} style={{ marginTop: 18 }}>{submitting ? 'Creating…' : <>Create my MicroStore <Icon name="arrowr" size={18} /></>}</button>
    </form>
  );
}

function CelebrityQuickCreate() {
  const { go, toast } = useStore();
  const [f, setF] = useState({ name: '', tagline: '' });
  const [err, setErr] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [store, setStore] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!f.name.trim()) { setErr('Enter a store name'); return; }
    setErr('');
    setSubmitting(true);
    try {
      const res = await myCelebrityStoreApi.create({ name: f.name.trim(), tagline: f.tagline.trim() || undefined });
      setStore(res?.celebrity_store || res);
      toast('Celebrity Store created!');
    } catch (err2) {
      toast(messageFrom(err2, 'Could not create your Celebrity Store'));
    } finally {
      setSubmitting(false);
    }
  };

  if (store) {
    const slug = store.slug;
    return (
      <div className="aff-success card">
        <div className="success-check" style={{ width: 64, height: 64, marginBottom: 16 }}><Icon name="check" size={30} stroke={3} /></div>
        <h3 style={{ fontSize: 22 }}>Your Celebrity Store is live!</h3>
        {slug && <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => go('celebrityStore', slug)}>View my storefront</button>}
      </div>
    );
  }

  return (
    <form className="aff-form card" onSubmit={submit}>
      <h3 style={{ fontSize: 22, marginBottom: 4 }}>Create your Celebrity Store</h3>
      <p className="muted" style={{ fontSize: 14, marginBottom: 20 }}>You&rsquo;re signed in — set up your storefront in one step.</p>
      <div className="form-grid">
        <CreatorField label="Store name" full value={f.name} onChange={(v) => setF((s) => ({ ...s, name: v }))} err={err} placeholder="Jay's Edit" />
        <CreatorField label="Tagline (optional)" full value={f.tagline} onChange={(v) => setF((s) => ({ ...s, tagline: v }))} placeholder="Curated picks from my closet" />
      </div>
      <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={submitting} style={{ marginTop: 18 }}>{submitting ? 'Creating…' : <>Create my Celebrity Store <Icon name="arrowr" size={18} /></>}</button>
    </form>
  );
}

export function CreatorApplyForm({ rateNote = 'Free to join · earn commissions on a rolling 90-day basis.', termsLabel = 'Affiliate', signupRoute, signupLabel = 'Create your account', program = 'affiliate' }) {
  const { go, toast, isAuthenticated } = useStore();
  const [f, setF] = useState({ name: '', email: '', channel: 'instagram', handle: '', audience: '10k-50k', about: '' });
  const [errs, setErrs] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [appStatus, setAppStatus] = useState(null);

  useEffect(() => {
    if (!isAuthenticated || program !== 'affiliate') return;
    let active = true;
    affiliateApi.applicationStatus()
      .then((res) => { if (active && res && (res.status || res.application)) setAppStatus(res.application || res); })
      .catch(() => {});
    return () => { active = false; };
  }, [isAuthenticated, program]);

  // Anonymous visitors don't get the apply form at all — joining a program
  // starts from its own dedicated signup flow (CreatorSignup.jsx), which
  // creates the account and submits the application in one go, instead of
  // faking a success here with nothing ever reaching the backend.
  if (!isAuthenticated && signupRoute) {
    return (
      <div className="aff-form card" style={{ textAlign: 'center' }}>
        <h3 style={{ fontSize: 22, marginBottom: 8 }}>Ready to join?</h3>
        <p className="muted" style={{ marginBottom: 20 }}>{rateNote}</p>
        <button className="btn btn-primary btn-block btn-lg" onClick={() => go(signupRoute)}>{signupLabel} <Icon name="arrowr" size={18} /></button>
        <p className="muted" style={{ fontSize: 13, marginTop: 14 }}>
          Already applied? <a className="link-btn" onClick={() => go('auth', 'signin')}>Sign in</a> to check your status.
        </p>
      </div>
    );
  }

  // Already signed in: MicroStore creation is instant and self-service
  // (no `applications` endpoint for it, unlike Affiliate) — skip straight
  // to a focused create form instead of the affiliate-shaped fields below.
  if (isAuthenticated && program === 'microstore') return <MicrostoreQuickCreate />;

  // Celebrity Store creation is instant and self-service (no `applications`
  // endpoint for it, same as MicroStore) — skip straight to a focused create
  // form instead of the affiliate-shaped fields below.
  if (isAuthenticated && program === 'celebrity') return <CelebrityQuickCreate />;

  const submit = async (e) => {
    e.preventDefault();
    const er = {};
    if (!f.name.trim()) er.name = 'Enter your full name';
    if (!/^\S+@\S+\.\S+$/.test(f.email)) er.email = 'Enter a valid email';
    if (!f.handle.trim()) er.handle = 'Add your channel / page link';
    setErrs(er);
    if (Object.keys(er).length) return;
    setSubmitting(true);
    try {
      const handle = f.handle.trim();
      const res = await affiliateApi.apply({
        promotion_channels: [f.channel],
        website_url: handle ? (/^https?:\/\//i.test(handle) ? handle : `https://${handle}`) : undefined,
        notes: f.about.trim() || undefined,
      });
      setAppStatus(res?.application || res);
      toast('Application submitted!');
    } catch (err) {
      toast(messageFrom(err, 'Could not submit application'));
    } finally {
      setSubmitting(false);
    }
  };

  if (appStatus) {
    return (
      <div className="aff-success card">
        <div className="success-check" style={{ width: 64, height: 64, marginBottom: 16 }}><Icon name="clock" size={30} /></div>
        <h3 style={{ fontSize: 22 }}>Application {appStatus.status || 'received'}</h3>
        <p className="muted" style={{ marginTop: 8 }}>
          {appStatus.status === 'approved'
            ? 'Your creator application has been approved. Head to your Affiliate Dashboard to start sharing links.'
            : 'We have your application on file and our team is reviewing it.'}
        </p>
        {appStatus.status === 'approved' && (
          <Link href="/affiliate/dashboard" className="btn btn-primary" style={{ marginTop: 14 }}>Open Affiliate Dashboard</Link>
        )}
      </div>
    );
  }

  return (
    <form className="aff-form card" onSubmit={submit}>
      <h3 style={{ fontSize: 22, marginBottom: 4 }}>Apply to the program</h3>
      <p className="muted" style={{ fontSize: 14, marginBottom: 20 }}>{rateNote}</p>
      <div className="form-grid">
        <CreatorField label="Full name" value={f.name} onChange={v => setF(s => ({ ...s, name: v }))} err={errs.name} placeholder="Lucy Limitra" />
        <CreatorField label="Email address" type="email" value={f.email} onChange={v => setF(s => ({ ...s, email: v }))} err={errs.email} placeholder="you@email.com" />
        <div className="field">
          <label>Main channel</label>
          <div className="sort-wrap" style={{ height: 49, borderRadius: 'var(--r-sm)', width: '100%' }}>
            <select className="sort-sel" style={{ width: '100%' }} value={f.channel} onChange={e => setF(s => ({ ...s, channel: e.target.value }))}>
              {['Instagram', 'TikTok', 'YouTube', 'X / Twitter', 'Blog / Website', 'WhatsApp / Telegram'].map(c => <option key={c}>{c}</option>)}
            </select>
            <Icon name="chevdown" size={15} className="muted sort-chev" />
          </div>
        </div>
        <div className="field">
          <label>Audience size</label>
          <div className="sort-wrap" style={{ height: 49, borderRadius: 'var(--r-sm)', width: '100%' }}>
            <select className="sort-sel" style={{ width: '100%' }} value={f.audience} onChange={e => setF(s => ({ ...s, audience: e.target.value }))}>
              {['Under 10k', '10k-50k', '50k-250k', '250k+'].map(c => <option key={c}>{c}</option>)}
            </select>
            <Icon name="chevdown" size={15} className="muted sort-chev" />
          </div>
        </div>
        <CreatorField label="Channel / page link" full value={f.handle} onChange={v => setF(s => ({ ...s, handle: v }))} err={errs.handle} placeholder="instagram.com/yourhandle" />
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label>Tell us about your audience <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label>
          <textarea className="input" rows={3} style={{ resize: 'vertical', fontFamily: 'inherit' }} value={f.about} placeholder="Who follows you and what do they love to shop for?" onChange={e => setF(s => ({ ...s, about: e.target.value }))} />
        </div>
      </div>
      <button className="btn btn-primary btn-block btn-lg" type="submit" style={{ marginTop: 18 }}>Submit application <Icon name="arrowr" size={18} /></button>
      <p className="muted" style={{ fontSize: 12, textAlign: 'center', marginTop: 12 }}>By applying you agree to the {termsLabel} <Link href="/help/terms" className="link-btn" style={{ display: 'inline' }}>Terms</Link>.</p>
    </form>
  );
}

export function ApplySection({ id = 'apply', eyebrow = 'Join today', title, desc, faqs, apply }) {
  const [openF, setOpenF] = useState(0);
  return (
    <section className="sec" id={id} style={{ paddingTop: 8 }}>
      <div className="wrap aff-apply-grid">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2 style={{ fontSize: 32, margin: '6px 0 16px' }}>{title}</h2>
          <p className="muted" style={{ fontSize: 16, marginBottom: 26, maxWidth: 440, textWrap: 'pretty' }}>{desc}</p>
          <div className="faq-list" style={{ maxWidth: 480 }}>
            {faqs.map(([qq, a], i) => (
              <div key={i} className={'faq-item' + (openF === i ? ' open' : '')}>
                <button className="faq-q" onClick={() => setOpenF(openF === i ? -1 : i)}><span>{qq}</span><Icon name={openF === i ? 'minus' : 'plus'} size={18} /></button>
                <div className="faq-a"><p>{a}</p></div>
              </div>
            ))}
          </div>
        </div>
        <div className="aff-apply-form"><CreatorApplyForm {...apply} /></div>
      </div>
    </section>
  );
}
