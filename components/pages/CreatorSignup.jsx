'use client';
/* LIMITRA, dedicated "create account" flows for the three Creator Programs
   (Affiliate, MicroStores, Celebrity Stores) — unlike the generic /auth/signup
   screen, these collect the program's own details in the same form and chain
   signup -> verify-email -> apply/create automatically, so joining a program
   never requires setting up a plain customer account first. */
import { useState } from 'react';
import { Icon, Logo } from '@/components/icons/Icon';
import { useStore } from '@/components/store/StoreProvider';
import { OtpInput } from '@/components/pages/AuthPage';
import { FormAlert } from '@/components/forms/Shared';
import { Breadcrumbs } from '@/components/ui/Shared';
import { authApi, affiliateApi, myMicrostoreApi, myCelebrityStoreApi } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { fieldErrorsFrom, messageFrom } from '@/lib/api/errors';
import { getToken } from '@/lib/auth';

const CHANNELS = ['Instagram', 'TikTok', 'YouTube', 'X / Twitter', 'Blog / Website', 'WhatsApp / Telegram'];
const AUDIENCES = ['Under 10k', '10k-50k', '50k-250k', '250k+'];

// The "Channel / page link" field is filled in like "instagram.com/you",
// but the backend's website_url validator requires a full URL with a scheme
// — prepend one rather than reject what looks like a perfectly normal handle.
const toUrl = (v) => {
  const s = v.trim();
  if (!s) return undefined;
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
};

const PROGRAMS = {
  affiliate: {
    label: 'Affiliate',
    icon: 'share',
    eyebrow: 'Join the Affiliate Program',
    title: 'Become a Limitra Affiliate',
    desc: 'Create your affiliate account in one step — share products, earn commissions, no storefront needed.',
    breadcrumb: 'Become an Affiliate',
    details: [
      { key: 'channel', label: 'Main channel', type: 'select', options: CHANNELS, default: CHANNELS[0] },
      { key: 'audience', label: 'Audience size', type: 'select', options: AUDIENCES, default: AUDIENCES[1] },
      { key: 'handle', label: 'Channel / page link', placeholder: 'instagram.com/yourhandle', full: true },
      { key: 'about', label: 'Tell us about your audience (optional)', type: 'textarea', optional: true, full: true, placeholder: 'Who follows you and what do they love to shop for?' },
    ],
    submit: (f) => affiliateApi.apply({
      promotion_channels: [f.channel.toLowerCase().replace(/\s*\/.*$/, '').trim()],
      website_url: toUrl(f.handle),
      notes: f.about.trim() || undefined,
    }),
    successTitle: 'Application submitted!',
    successBody: 'Your account is ready and your affiliate application is in. Our partner team will review it and you’ll get an email once it’s approved.',
  },
  microstore: {
    label: 'MicroStore',
    icon: 'store',
    eyebrow: 'Start a MicroStore',
    title: 'Create Your MicroStore',
    desc: 'Set up your account and your storefront together — no inventory to buy, Limitra handles fulfillment.',
    breadcrumb: 'Start a MicroStore',
    details: [
      { key: 'storeName', label: 'Store name', placeholder: 'Lucy’s Picks', full: true },
      { key: 'tagline', label: 'Tagline (optional)', optional: true, full: true, placeholder: 'Curated tech & lifestyle finds' },
      { key: 'bio', label: 'About your store (optional)', type: 'textarea', optional: true, full: true, placeholder: 'What makes your store worth following?' },
    ],
    submit: (f) => myMicrostoreApi.create({
      name: f.storeName.trim(),
      tagline: f.tagline.trim() || undefined,
      bio: f.bio.trim() || undefined,
    }),
    successTitle: 'Your MicroStore is live!',
    successBody: 'Your account and storefront have both been created.',
  },
  celebrity: {
    label: 'Celebrity Store',
    icon: 'star',
    eyebrow: 'Apply for a Celebrity Store',
    title: 'Become a Celebrity Store Partner',
    desc: 'Create your account and set up your Celebrity Store together — a premium storefront for your personal brand.',
    breadcrumb: 'Celebrity Store',
    details: [
      { key: 'storeName', label: 'Store name', placeholder: 'Jay’s Edit', full: true },
      { key: 'tagline', label: 'Tagline (optional)', optional: true, full: true, placeholder: 'Curated picks from my closet' },
      { key: 'bio', label: 'About your store (optional)', type: 'textarea', optional: true, full: true, placeholder: 'What makes your store worth following?' },
    ],
    submit: (f) => myCelebrityStoreApi.create({
      name: f.storeName.trim(),
      tagline: f.tagline.trim() || undefined,
      bio: f.bio.trim() || undefined,
    }),
    successTitle: 'Your Celebrity Store is live!',
    successBody: 'Your account and storefront have both been created.',
  },
};

function Field({ def, value, onChange, err }) {
  return (
    <div className="field" style={{ gridColumn: def.full ? '1 / -1' : 'auto' }}>
      <label>{def.label}</label>
      {def.type === 'select' ? (
        <div className="sort-wrap" style={{ height: 49, borderRadius: 'var(--r-sm)', width: '100%' }}>
          <select className="sort-sel" style={{ width: '100%' }} value={value} onChange={(e) => onChange(e.target.value)}>
            {def.options.map((o) => <option key={o}>{o}</option>)}
          </select>
          <Icon name="chevdown" size={15} className="muted sort-chev" />
        </div>
      ) : def.type === 'textarea' ? (
        <textarea className="input" rows={3} style={{ resize: 'vertical', fontFamily: 'inherit' }} value={value} placeholder={def.placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className={'input' + (err ? ' err' : '')} value={value} placeholder={def.placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
      {err && <span className="err-msg">{err}</span>}
    </div>
  );
}

export function CreatorSignupPage({ program }) {
  const { go, toast } = useStore();
  const cfg = PROGRAMS[program];
  const [step, setStep] = useState('form'); // form -> otp -> success
  const [f, setF] = useState(() => ({
    name: '', email: '', password: '', confirm: '',
    ...Object.fromEntries(cfg.details.map((d) => [d.key, d.default || ''])),
  }));
  const [errs, setErrs] = useState({});
  const [formError, setFormError] = useState('');
  const [otp, setOtp] = useState('');
  const [otpErr, setOtpErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const set = (key, v) => setF((s) => ({ ...s, [key]: v }));

  const submitForm = async (e) => {
    e.preventDefault();
    const er = {};
    if (!f.name.trim()) er.name = 'Enter your full name';
    if (!/^\S+@\S+\.\S+$/.test(f.email)) er.email = 'Enter a valid email';
    if (f.password.length < 6) er.password = 'At least 6 characters';
    if (f.confirm !== f.password) er.confirm = 'Passwords don’t match';
    cfg.details.forEach((d) => { if (!d.optional && !String(f[d.key] || '').trim()) er[d.key] = 'Required'; });
    setErrs(er);
    setFormError('');
    if (Object.keys(er).length) return;

    setLoading(true);
    try {
      await authApi.signup({
        name: f.name.trim(),
        email: f.email.trim(),
        password: f.password,
        password_confirmation: f.confirm,
      });
      setOtp('');
      setOtpErr('');
      setStep('otp');
    } catch (err) {
      const fe = err instanceof ApiError && err.status === 422 ? fieldErrorsFrom(err) : {};
      if (Object.keys(fe).length) {
        setErrs({ name: fe.name, email: fe.email, password: fe.password, confirm: fe.password_confirmation });
      } else {
        setFormError(messageFrom(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const submitOtp = async (e) => {
    e.preventDefault();
    if (otp.length < 6) { setOtpErr('Enter the 6-digit code'); return; }
    setLoading(true);
    setOtpErr('');
    try {
      await authApi.verifyEmail({ email: f.email.trim(), otp });
      try { window.dispatchEvent(new Event('lim:signup')); } catch (e2) {}
      // verify-email is documented to return a session token, but if the live
      // backend doesn't actually issue one here, the next call (cfg.submit)
      // would silently 401 with no token attached — log in explicitly with
      // the password just set, rather than trust that assumption blindly.
      if (!getToken()) {
        await authApi.login({ email: f.email.trim(), password: f.password });
      }
      if (cfg.submit) {
        try {
          await cfg.submit(f);
          setSubmitError('');
        } catch (err) {
          setSubmitError(messageFrom(err, `We couldn’t set up your ${cfg.label} account.`));
        }
      }
      setStep('success');
    } catch (err) {
      const fe = err instanceof ApiError && err.status === 422 ? fieldErrorsFrom(err) : {};
      setOtpErr(fe.otp || messageFrom(err));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    try { await authApi.resendVerification({ email: f.email.trim() }); toast('Verification code resent'); }
    catch (err) { toast(messageFrom(err), 'error'); }
  };

  const retrySubmit = async () => {
    if (!cfg.submit) return;
    setLoading(true);
    try {
      await cfg.submit(f);
      setSubmitError('');
      toast(`${cfg.label} account set up!`);
    } catch (err) {
      setSubmitError(messageFrom(err, `We couldn’t set up your ${cfg.label} account.`));
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="page page-fade">
      <div className="wrap"><Breadcrumbs items={[{ label: 'Home', to: ['home'] }, { label: cfg.breadcrumb }]} /></div>

      <section className="sec" style={{ paddingTop: 10, maxWidth: 640, marginInline: 'auto' }}>
        <div className="wrap">
          {step !== 'success' && (
            <div className="aff-sec-head" style={{ textAlign: 'center', marginBottom: 20 }}>
              <span className="eyebrow">{cfg.eyebrow}</span>
              <h1 style={{ fontSize: 30 }}>{cfg.title}</h1>
              <p className="muted" style={{ marginTop: 10, textWrap: 'pretty' }}>{cfg.desc}</p>
            </div>
          )}

          {step === 'form' && (
            <form className="aff-form card" onSubmit={submitForm}>
              <FormAlert>{formError}</FormAlert>
              <div className="form-grid">
                <Field def={{ key: 'name', label: 'Full name', placeholder: 'Lucy Limitra' }} value={f.name} onChange={(v) => set('name', v)} err={errs.name} />
                <Field def={{ key: 'email', label: 'Email address', placeholder: 'you@email.com' }} value={f.email} onChange={(v) => set('email', v)} err={errs.email} />
                <Field def={{ key: 'password', label: 'Password', placeholder: '••••••••' }} value={f.password} onChange={(v) => set('password', v)} err={errs.password} />
                <Field def={{ key: 'confirm', label: 'Confirm password', placeholder: '••••••••' }} value={f.confirm} onChange={(v) => set('confirm', v)} err={errs.confirm} />
                {cfg.details.map((d) => (
                  <Field key={d.key} def={d} value={f[d.key]} onChange={(v) => set(d.key, v)} err={errs[d.key]} />
                ))}
              </div>
              <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={loading} style={{ marginTop: 18 }}>
                {loading ? <span className="auth-spin" /> : <>Create my {cfg.label} account <Icon name="arrowr" size={18} /></>}
              </button>
              <p className="muted" style={{ fontSize: 12, textAlign: 'center', marginTop: 12 }}>
                Already have a Limitra account? <a className="link-btn" onClick={() => go('auth', 'signin')}>Sign in</a> instead.
              </p>
            </form>
          )}

          {step === 'otp' && (
            <form className="aff-form card" onSubmit={submitOtp} style={{ textAlign: 'center' }}>
              <h3 style={{ fontSize: 20, marginBottom: 6 }}>Verify it’s you</h3>
              <p className="muted" style={{ marginBottom: 20 }}>We sent a 6-digit code to {f.email}.</p>
              <div style={{ display: 'flex', justifyContent: 'center' }}><OtpInput onChange={setOtp} /></div>
              {otpErr && <span className="err-msg">{otpErr}</span>}
              <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={loading} style={{ marginTop: 20 }}>
                {loading ? <span className="auth-spin" /> : 'Verify & continue'}
              </button>
              <p className="muted" style={{ marginTop: 14, fontSize: 13.5 }}>
                Didn’t get the code? <a className="link-btn" onClick={resend}>Resend code</a>
              </p>
            </form>
          )}

          {step === 'success' && submitError && (
            <div className="aff-success card">
              <div className="success-check" style={{ width: 72, height: 72, marginBottom: 20, background: 'var(--red-soft, #FDE8E8)' }}><Icon name="close" size={32} stroke={3} /></div>
              <h3 style={{ fontSize: 22 }}>Your account was created</h3>
              <p className="muted" style={{ marginTop: 8 }}>But setting up your {cfg.label} account failed: {submitError}</p>
              <button className="btn btn-primary" disabled={loading} style={{ marginTop: 14 }} onClick={retrySubmit}>{loading ? 'Retrying…' : 'Try again'}</button>
              <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>
                Or <a className="link-btn" onClick={() => go('account')}>go to your account</a> and try later.
              </p>
            </div>
          )}

          {step === 'success' && !submitError && (
            <div className="aff-success card">
              <div className="success-check" style={{ width: 72, height: 72, marginBottom: 20 }}><Icon name="check" size={36} stroke={3} /></div>
              <h3 style={{ fontSize: 24 }}>{cfg.successTitle}</h3>
              <p className="muted" style={{ marginTop: 8 }}>{cfg.successBody}</p>
              {program === 'microstore' && (
                <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => go('microstoreDashboard')}>Go to my MicroStore dashboard</button>
              )}
              {program === 'celebrity' && (
                <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => go('celebrityStoreDashboard')}>Go to my Celebrity Store dashboard</button>
              )}
              {program !== 'microstore' && program !== 'celebrity' && (
                <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => go('account')}>Go to my account</button>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
