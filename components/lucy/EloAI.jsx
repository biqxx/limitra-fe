'use client';
/* LIMITRA, Elo AI shopping assistant (text + image upload / visual search) — ported from legacy/lucy.jsx */
import { useState, useRef, useEffect } from 'react';
import { Icon } from '@/components/icons/Icon';
import { Thumb, REAL_IMG } from '@/components/ui/Shared';
import { useStore } from '@/components/store/StoreProvider';
import { PRODUCTS, naira, byId } from '@/lib/data';
import { aiConversationsApi } from '@/lib/api/endpoints';

const GREETING = "Hi, I'm Elo 👋 your Limitra shopping assistant. Ask me anything, or tap the + to upload a photo and I'll find similar products in our store.";

// Module-level (not inside the component) so the React Compiler's purity
// check doesn't flag Date.now()/Math.random() as an impure call reachable
// from component render — same reasoning as the identical idemKey pattern
// in components/pages/Cart.jsx, just not tucked inside a useState initializer.
function genClientMessageId() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random();
}

// Response shape is undocumented — role/text/images/product-id fields are
// all read defensively under several plausible names.
function mapAiProduct(raw) {
  if (!raw) return null;
  if (typeof raw !== 'object') return byId(raw) || null;
  const cached = byId(raw.id);
  if (cached) return cached;
  const price = Number(raw.price ?? raw.sale_price ?? 0);
  const oldPrice = Number(raw.compare_at_price ?? raw.old_price ?? 0);
  const img = raw.image_url ?? raw.thumbnail ?? raw.image ?? (Array.isArray(raw.images) ? (typeof raw.images[0] === 'string' ? raw.images[0] : raw.images[0]?.url) : null);
  return {
    id: raw.id,
    slug: raw.slug || raw.id,
    name: raw.name || raw.title || 'Product',
    price: Number.isFinite(price) ? price : 0,
    oldPrice: Number.isFinite(oldPrice) && oldPrice > price ? oldPrice : 0,
    off: price > 0 && oldPrice > price ? Math.round(((oldPrice - price) / oldPrice) * 100) : Number(raw.off || 0),
    brand: raw.brand || raw.category?.name || '',
    rating: Number(raw.average_rating ?? raw.rating ?? 0),
    image: img || null,
    images: img ? [img] : [],
  };
}

function normalizeAiMessage(m) {
  const role = m.role ?? (m.is_assistant || m.sender === 'assistant' || m.author_type === 'assistant' || m.from === 'ai' ? 'assistant' : 'user');
  const rawProducts = m.metadata?.products ?? m.products ?? m.product_ids ?? [];
  const seen = new Set();
  const products = [];
  for (const item of (Array.isArray(rawProducts) ? rawProducts : [])) {
    const mapped = mapAiProduct(item);
    if (mapped && mapped.id != null && !seen.has(String(mapped.id))) {
      seen.add(String(mapped.id));
      products.push(mapped);
    }
  }
  return {
    role,
    text: m.text ?? m.message ?? m.content ?? '',
    images: Array.isArray(m.images) ? m.images : (Array.isArray(m.attachments) ? m.attachments : []),
    clientId: m.client_message_id,
    products,
  };
}

const ELO_MAX_IMAGES = 3;
const ELO_MAX_BYTES = 5 * 1024 * 1024; // 5MB (matches backend validation)
const ELO_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

/* compress an image File to a capped-size JPEG Blob + preview data URL (max 1024px long edge) */
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 1024;
      let { width, height } = img;
      if (width > max || height > max) {
        const r = Math.min(max / width, max / height);
        width = Math.round(width * r); height = Math.round(height * r);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      const src = canvas.toDataURL('image/jpeg', 0.82);
      canvas.toBlob((blob) => {
        resolve({ src, blob });
      }, 'image/jpeg', 0.82);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
    img.src = url;
  });
}

const ELO_STORAGE_KEY = 'lim_elo_chat_v2';

export function EloAI() {
  const { go, addToCart, toggleWish, wish, isAuthenticated, refreshCart } = useStore();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [msgs, setMsgs] = useState([{ role: 'assistant', text: GREETING }]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState([]); // staged images (data URLs) before send
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [err, setErr] = useState('');
  // Real backend conversation — null until the first message is sent.
  // Signed-in users authenticate via bearer token; guests use guestToken.
  const [conversationId, setConversationId] = useState(null);
  const [guestToken, setGuestToken] = useState(null);
  const [hydrated, setHydrated] = useState(false);
  const bodyRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(ELO_STORAGE_KEY) || 'null');
      if (saved && Array.isArray(saved.msgs) && saved.msgs.length > 0) {
        setMsgs(saved.msgs);
      }
      if (saved && saved.conversationId) {
        setConversationId(saved.conversationId);
      }
      if (saved && saved.guestToken) {
        setGuestToken(saved.guestToken);
      }
    } catch (e) {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(ELO_STORAGE_KEY, JSON.stringify({ conversationId, guestToken, msgs }));
    } catch (e) {}
  }, [hydrated, conversationId, guestToken, msgs]);

  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [msgs, open, busy, pending]);

  const suggestions = ['Recommend a phone under ₦400k', 'Best laptop for students', 'Find wireless earbuds', 'Where is my order?'];

  const addFiles = async (fileList) => {
    setErr('');
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const slots = ELO_MAX_IMAGES - pending.length;
    if (slots <= 0) { setErr(`You can attach up to ${ELO_MAX_IMAGES} images.`); return; }
    const next = [];
    for (const f of files.slice(0, slots)) {
      if (!ELO_TYPES.includes(f.type)) { setErr('Unsupported file, use JPG, PNG or WEBP.'); continue; }
      if (f.size > ELO_MAX_BYTES) { setErr('Image too large, max 5MB.'); continue; }
      try {
        const { src, blob } = await compressImage(f);
        next.push({ src, blob, name: f.name || 'photo.jpg' });
      }
      catch (e) { setErr('Could not read that image, please try another.'); }
    }
    if (next.length) setPending(p => [...p, ...next].slice(0, ELO_MAX_IMAGES));
  };

  const onDrop = (e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files); };

  const onPaste = (e) => {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    const imgs = [];
    for (const it of items) { if (it.kind === 'file' && it.type.startsWith('image/')) { const f = it.getAsFile(); if (f) imgs.push(f); } }
    if (imgs.length) { e.preventDefault(); addFiles(imgs); }
  };

  const sendReal = async (q, imgs, retried = false) => {
    let convId = conversationId;
    let activeGuestToken = isAuthenticated ? null : guestToken;
    if (!convId) {
      const res = await aiConversationsApi.create({ channel: 'web' }, activeGuestToken);
      const data = res?.data ?? res;
      convId = data?.id ?? data?.conversation_id ?? data?.conversation?.id;
      if (!convId) throw new Error('Conversation was created but no id came back in the response.');
      if (!isAuthenticated && data?.guest_token) {
        activeGuestToken = data.guest_token;
        setGuestToken(data.guest_token);
      }
      setConversationId(convId);
    }
    const clientMessageId = genClientMessageId();
    const priorCount = msgs.length;
    let sendRes = null;
    try {
      if (imgs.length > 0) {
        const formData = new FormData();
        formData.append('text', q || 'Find similar products in the store based on this image.');
        formData.append('client_message_id', clientMessageId);
        imgs.forEach((img, idx) => {
          if (img.blob) {
            formData.append('images[]', img.blob, img.name || `photo-${idx + 1}.jpg`);
          }
        });
        sendRes = await aiConversationsApi.sendMessage(convId, formData, activeGuestToken);
      } else {
        sendRes = await aiConversationsApi.sendMessage(convId, {
          text: q,
          client_message_id: clientMessageId,
        }, activeGuestToken);
      }
    } catch (e) {
      if (!retried && conversationId && (e?.status === 401 || e?.status === 403 || e?.status === 404)) {
        setConversationId(null);
        setGuestToken(null);
        const res = await aiConversationsApi.create({ channel: 'web' }, null);
        const data = res?.data ?? res;
        convId = data?.id ?? data?.conversation_id ?? data?.conversation?.id;
        if (!convId) throw e;
        activeGuestToken = !isAuthenticated && data?.guest_token ? data.guest_token : null;
        if (activeGuestToken) setGuestToken(activeGuestToken);
        setConversationId(convId);
        if (imgs.length > 0) {
          const formData = new FormData();
          formData.append('text', q || 'Find similar products in the store based on this image.');
          formData.append('client_message_id', genClientMessageId());
          imgs.forEach((img, idx) => {
            if (img.blob) formData.append('images[]', img.blob, img.name || `photo-${idx + 1}.jpg`);
          });
          sendRes = await aiConversationsApi.sendMessage(convId, formData, activeGuestToken);
        } else {
          sendRes = await aiConversationsApi.sendMessage(convId, {
            text: q,
            client_message_id: genClientMessageId(),
          }, activeGuestToken);
        }
      } else {
        throw e;
      }
    }
    const sendMsg = sendRes?.data ?? sendRes;
    const sendActions = sendMsg?.metadata?.actions ?? sendMsg?.actions ?? [];
    if (Array.isArray(sendActions) && sendActions.some(a => a?.type === 'cart_updated') && typeof refreshCart === 'function') {
      refreshCart();
    }
    if (sendMsg && (sendMsg.role === 'assistant' || sendMsg.content || sendMsg.text)) {
      setMsgs(m => [...m, normalizeAiMessage(sendMsg)]);
      return;
    }
    for (let attempt = 0; attempt < 8; attempt++) {
      const res = await aiConversationsApi.messages(convId, activeGuestToken);
      const list = Array.isArray(res) ? res : (res?.data?.items ?? res?.items ?? res?.data ?? []);
      const normalized = (Array.isArray(list) ? list : []).map(normalizeAiMessage);
      const freshAssistant = normalized.slice(priorCount).filter(m => m.role === 'assistant');
      if (freshAssistant.length) {
        setMsgs(m => [...m, ...freshAssistant]);
        return;
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    setMsgs(m => [...m, { role: 'assistant', text: "Still working on that — feel free to keep browsing, I'll have an answer shortly." }]);
  };

  const send = async (text) => {
    const q = (text != null ? text : input).trim();
    const imgs = pending;
    if ((!q && imgs.length === 0) || busy) return;
    setInput(''); setPending([]); setErr('');
    setMsgs(m => [...m, { role: 'user', text: q, images: imgs.map(i => i.src) }]);
    setBusy(true);
    try {
      await sendReal(q, imgs);
    } catch (e) {
      setMsgs(m => [...m, { role: 'assistant', text: "Sorry, I had trouble responding just then. Please try again in a moment." }]);
    } finally {
      setBusy(false);
    }
  };

  const handoff = async () => {
    if (!conversationId || !isAuthenticated) return;
    try {
      await aiConversationsApi.handoff(conversationId, 'Customer requested human support');
      setMsgs(m => [...m, { role: 'assistant', text: "You've been connected to our support team — they'll follow up with you shortly." }]);
    } catch (e) {
      setMsgs(m => [...m, { role: 'assistant', text: "Couldn't reach support just now — please try again in a moment." }]);
    }
  };

  const clearChat = async () => {
    if (conversationId) { try { await aiConversationsApi.remove(conversationId, isAuthenticated ? null : guestToken); } catch (e) {} }
    setConversationId(null);
    setGuestToken(null);
    setMsgs([{ role: 'assistant', text: GREETING }]);
    setPending([]); setErr('');
    try { sessionStorage.removeItem(ELO_STORAGE_KEY); } catch (e) {}
  };

  return (
    <>
      <button className={'lucy-fab' + (open ? ' open' : '')} onClick={() => setOpen(o => !o)} aria-label={open ? 'Close Elo' : 'Ask Elo assistant'}>
        {open ? <Icon name="close" size={24} /> : <><span className="lucy-fab-badge"><img src="/assets/elo-face.png" alt="" /></span><span className="lucy-fab-text">Ask Elo</span></>}
        {!open && <span className="lucy-pulse" />}
      </button>

      {open && (
        <div className={'lucy-panel' + (expanded ? ' expanded' : '')} role="dialog" aria-label="Elo"
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={e => { if (e.currentTarget === e.target) setDragOver(false); }}
          onPaste={onPaste}
          onDrop={onDrop}>
          <div className="lucy-head">
            <button className="lucy-head-btn" onClick={clearChat} aria-label="Clear chat" title="Clear chat"><Icon name="trash" size={19} /></button>
            <div className="lucy-head-center">
              <span className="lucy-avatar"><span className="lucy-av-text">Elo</span></span>
              <b>Shop with Elo</b>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {conversationId && isAuthenticated && <button className="lucy-head-btn" onClick={handoff} aria-label="Talk to a human" title="Talk to a human"><Icon name="headset" size={18} /></button>}
              <button className="lucy-head-btn lucy-expand-btn" onClick={() => setExpanded(e => !e)} aria-label={expanded ? 'Collapse Elo' : 'Expand Elo'} title={expanded ? 'Collapse' : 'Expand'}><Icon name={expanded ? 'minimize' : 'maximize'} size={17} /></button>
              <button className="lucy-head-btn" onClick={() => setOpen(false)} aria-label="Close"><Icon name="close" size={20} /></button>
            </div>
          </div>

          <div className="lucy-body" ref={bodyRef}>
            {msgs.map((m, i) => (
              <div key={i} className={'lucy-msg ' + m.role + (m.products?.length ? ' has-cards' : '')}>
                {m.role === 'assistant' && <span className="lucy-msg-av"><span className="lucy-av-text sm">Elo</span></span>}
                {m.role === 'user' && <span className="lucy-msg-av user"><Icon name="user" size={14} /></span>}
                <div className="lucy-bubble">
                  {m.images && m.images.length > 0 && (
                    <div className={'lucy-msg-imgs n' + Math.min(m.images.length, 3)}>
                      {m.images.map((src, j) => <img key={j} src={src} alt="shared" />)}
                    </div>
                  )}
                  {m.text && <span>{m.text}</span>}
                  {m.products && m.products.length > 0 && (
                    <div className="lucy-cards">
                      {m.products.map(item => {
                        const p = typeof item === 'object' ? (byId(item.id) || item) : byId(item);
                        if (!p) return null;
                        const faved = wish.includes(p.id);
                        const openProduct = () => { go('product', p.slug || p.id); setOpen(false); };
                        const thumbSrc = REAL_IMG[p.id] || p.image || p.images?.[0];
                        return (
                          <div className="lucy-card" key={p.id} onClick={openProduct} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openProduct(); } }}>
                            <div className="lucy-card-thumb">
                              <Thumb product={p} src={thumbSrc} />
                              {p.off > 0 && <span className="lucy-card-badge">-{p.off}%</span>}
                            </div>
                            <div className="lucy-card-main">
                              <div className="lucy-card-info">
                                {p.brand && <span className="lucy-card-brand">{p.brand}</span>}
                                <b>{p.name}</b>
                                <div className="lucy-card-price-row">
                                  <span className="lucy-card-price">{naira(p.price)}</span>
                                  {p.oldPrice > p.price && <span className="lucy-card-old">{naira(p.oldPrice)}</span>}
                                </div>
                              </div>
                              <div className="lucy-card-actions">
                                <button
                                  type="button"
                                  className="lucy-card-icon primary"
                                  title="Add to cart"
                                  aria-label="Add to cart"
                                  onClick={e => { e.stopPropagation(); addToCart(p); }}
                                >
                                  <Icon name="cart" size={15} />
                                  <span>Add</span>
                                </button>
                                <button
                                  type="button"
                                  className={'lucy-card-icon fav' + (faved ? ' on' : '')}
                                  title={faved ? 'Remove from favourites' : 'Add to favourites'}
                                  aria-label={faved ? 'Remove from favourites' : 'Add to favourites'}
                                  onClick={e => { e.stopPropagation(); toggleWish(p.id); }}
                                >
                                  <Icon name="heart" size={15} fill={faved ? 'currentColor' : 'none'} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="lucy-msg assistant">
                <span className="lucy-msg-av"><span className="lucy-av-text sm">Elo</span></span>
                <div className="lucy-bubble typing">{(pending.length > 0 || (msgs[msgs.length - 1]?.images?.length ?? 0) > 0) ? <span className="lucy-analyzing"><span className="lucy-spin" /> Looking at your photo…</span> : <><i /><i /><i /></>}</div>
              </div>
            )}
          </div>

          {dragOver && <div className="lucy-dropzone"><Icon name="download" size={28} /> Drop image to upload</div>}

          {msgs.length <= 1 && pending.length === 0 && (
            <div className="lucy-sugg">
              {suggestions.map(s => <button key={s} onClick={() => send(s)}>{s}</button>)}
            </div>
          )}

          {pending.length > 0 && (
            <div className="lucy-previews">
              {pending.map((p, i) => (
                <div className="lucy-prev" key={i}>
                  <img src={p.src} alt={p.name} />
                  <button className="lucy-prev-x" onClick={() => setPending(arr => arr.filter((_, j) => j !== i))} aria-label="Remove image"><Icon name="close" size={12} stroke={3} /></button>
                </div>
              ))}
            </div>
          )}
          {err && <div className="lucy-err">{err}</div>}

          <form className="lucy-input" onSubmit={e => { e.preventDefault(); send(); }}>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple capture="environment" hidden onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
            <button type="button" className="lucy-attach" onClick={() => fileRef.current && fileRef.current.click()} aria-label="Upload image" title="Upload image"><Icon name="plus" size={22} /></button>
            <input className="lucy-text" placeholder="Ask Elo, or upload a photo…" value={input} onChange={e => setInput(e.target.value)} />
            <button type="submit" className="lucy-send" disabled={(!input.trim() && pending.length === 0) || busy} aria-label="Send"><Icon name="arrowr" size={18} /></button>
          </form>
        </div>
      )}
    </>
  );
}
