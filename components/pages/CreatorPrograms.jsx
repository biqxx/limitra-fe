'use client';
/* Shared building blocks for Limitra's three "creator program" marketing pages
   (AffiliatePage.jsx, MicroStoresPage.jsx, CelebrityStoresPage.jsx) — the
   program-switcher cards, the 90-day performance-tier block, the per-category
   commission-rate table, the "which orders count" block, and the apply
   form + FAQ section. Keeping these in one place means the three pages stay
   visually and numerically consistent instead of drifting copies. */
import { useState } from 'react';
import { Icon, Logo } from '@/components/icons/Icon';
import { useStore } from '@/components/store/StoreProvider';
import { CREATOR_PROGRAMS } from '@/lib/creatorPrograms';
import { messageFrom } from '@/lib/api/errors';

const CP_PHOTO = '/assets/img/a09d96b52fb7936342b34355ffca656885ce52ff.png';

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
              <img className="cp-card-photo" src={CP_PHOTO} alt="" aria-hidden="true" />
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

export function CreatorApplyForm({ rateNote = 'Free to join · earn commissions on a rolling 90-day basis.', codePrefix = 'LIM', termsLabel = 'Affiliate', successBody, onSubmit, pendingBody }) {
  const { toast } = useStore();
  const [f, setF] = useState({ name: '', email: '', channel: 'instagram', handle: '', audience: '10k-50k', about: '' });
  const [errs, setErrs] = useState({});
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [code] = useState(codePrefix + Math.floor(100 + Math.random() * 900));

  const submit = async e => {
    e.preventDefault();
    const er = {};
    if (!f.name.trim()) er.name = 'Enter your full name';
    if (!/^\S+@\S+\.\S+$/.test(f.email)) er.email = 'Enter a valid email';
    if (!f.handle.trim()) er.handle = 'Add your channel / page link';
    setErrs(er);
    if (Object.keys(er).length) return;
    // onSubmit (real API call, currently only passed for the Affiliate program —
    // MicroStores/Celebrity Stores keep the old instant-fake-success behavior
    // until they have their own real endpoint) posts the application for admin
    // review, so there is no referral link/login to show yet — only a real
    // approval (adminAffiliatesApi.approveApplication) grants one.
    if (onSubmit) {
      setBusy(true);
      try {
        await onSubmit(f);
        setPending(true);
      } catch (error) {
        setErrs({ form: messageFrom(error) });
      } finally {
        setBusy(false);
      }
      return;
    }
    setDone(true);
    toast('Application submitted!');
  };

  if (pending) {
    return (
      <div className="aff-success card">
        <div className="success-check" style={{ width: 72, height: 72, marginBottom: 20 }}><Icon name="clock" size={36} stroke={3} /></div>
        <h3 style={{ fontSize: 24 }}>Application received, {f.name.split(' ')[0]}!</h3>
        <p className="muted" style={{ marginTop: 8 }}>{pendingBody || 'Our partner team reviews every application — we’ll email you at ' + f.email + ' once yours is approved.'}</p>
      </div>
    );
  }

  if (done) {
    const link = 'limitra.com.ng/r/' + code;
    return (
      <div className="aff-success card">
        <div className="success-check" style={{ width: 72, height: 72, marginBottom: 20 }}><Icon name="check" size={36} stroke={3} /></div>
        <h3 style={{ fontSize: 24 }}>You&rsquo;re in, {f.name.split(' ')[0]}! 🎉</h3>
        <p className="muted" style={{ marginTop: 8 }}>{successBody || 'Your application has been received. Our partner team will review it and get back to you shortly.'}</p>
        <div className="aff-link">
          <span className="muted" style={{ fontSize: 12 }}>Your referral link</span>
          <div className="aff-link-row">
            <code>{link}</code>
            <button className="btn btn-primary btn-sm" onClick={() => toast('Link copied to clipboard')}><Icon name="share" size={15} /> Copy</button>
          </div>
        </div>
        <p className="muted" style={{ fontSize: 13, marginTop: 16 }}>We&rsquo;ve emailed your dashboard login to <b>{f.email}</b>.</p>
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
      {errs.form && <p className="err-msg" style={{ marginTop: 10 }}>{errs.form}</p>}
      <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={busy} style={{ marginTop: 18 }}>{busy ? 'Submitting…' : 'Submit application'} <Icon name="arrowr" size={18} /></button>
      <p className="muted" style={{ fontSize: 12, textAlign: 'center', marginTop: 12 }}>By applying you agree to the {termsLabel} <a className="link-btn" style={{ display: 'inline' }}>Terms</a>.</p>
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
