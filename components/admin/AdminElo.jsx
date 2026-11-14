'use client';
/* Elo AI admin — conversations, knowledge base and model settings for the
   customer-facing assistant (components/lucy/EloAI.jsx). Response shapes
   are almost entirely undocumented here (empty `{}` schemas, generic
   SuccessResponse replies) — every read is defensive. Request schemas for
   knowledge/settings/conversation-update ARE documented (unlike most of
   this API) but still unverified live. */
import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/components/icons/Icon';
import { adminAiApi } from '@/lib/api/endpoints';
import { messageFrom } from '@/lib/api/errors';
import { useAdminToast } from './AdminToastContext';
import { AdmHead, Pager, usePager } from './AdminShared';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Deliberately not toLocaleDateString — ICU-data divergence between server
// (SSR) and browser (hydration) has caused a real hydration mismatch
// elsewhere in this app; this formatter can't diverge.
function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return isNaN(dt) ? String(d) : `${dt.getDate()} ${MONTHS_SHORT[dt.getMonth()]} ${dt.getFullYear()}`;
}

const asList = (res) => {
  const list = Array.isArray(res) ? res : (res?.data?.items ?? res?.items ?? res?.data ?? res?.results ?? []);
  return Array.isArray(list) ? list : [];
};

// Humanize a snake_case metrics key into a label, since the metrics
// response's own field names are completely undocumented.
const humanize = (k) => k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

function normalizeConversation(c) {
  const nameFromUser = c.user?.name
    ?? ([c.user?.first_name, c.user?.last_name].filter(Boolean).join(' ') || null)
    ?? c.user?.username
    ?? c.user?.email;
  const socialName = c.social_account?.username ? `@${c.social_account.username}` : null;
  return {
    id: c.id,
    customer: c.customer_name ?? c.customer?.name ?? nameFromUser ?? socialName ?? 'Guest',
    email: c.user?.email ?? null,
    status: c.status ?? 'open',
    channel: c.channel ?? c.social_account?.platform ?? null,
    date: c.last_message_at ?? c.updated_at ?? c.created_at,
  };
}

function normalizeDoc(d) {
  return {
    id: d.id,
    title: d.title ?? 'Untitled',
    slug: d.slug,
    category: d.category,
    content: d.content ?? '',
    indexed: d.indexed_at != null || d.is_indexed === true,
  };
}

function Drawer({ title, sub, saving, canSave, onClose, onSave, saveLabel, children }) {
  return (
    <>
      <div className="adm-drawer-scrim" onClick={onClose} />
      <aside className="adm-drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="adm-drawer-h">
          <div><h3>{title}</h3>{sub && <small className="muted">{sub}</small>}</div>
          <button className="adm-icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button>
        </div>
        <div className="adm-drawer-body">{children}</div>
        <div className="adm-drawer-f">
          <button className="adm-btn ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="adm-btn primary" onClick={onSave} disabled={saving || !canSave}>{saving ? 'Saving…' : saveLabel}</button>
        </div>
      </aside>
    </>
  );
}

const SECTIONS = [['conversations', 'Conversations'], ['knowledge', 'Knowledge base'], ['settings', 'Settings']];
const CONVO_STATUSES = ['open', 'handed_off', 'closed', 'archived'];
const CONVO_STATUS_CLS = { open: 'info', handed_off: 'warn', resolved: 'ok', closed: 'muted', archived: 'muted' };

export function AdminElo() {
  const toast = useAdminToast();
  const [section, setSection] = useState('conversations');

  const [metrics, setMetrics] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [docs, setDocs] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const [convoDraft, setConvoDraft] = useState(null);
  const [convoLoading, setConvoLoading] = useState(false);
  const [docDraft, setDocDraft] = useState(null);
  const [settingsDraft, setSettingsDraft] = useState(null);
  const [q, setQ] = useState('');

  const { shown: shownConvos, pagerProps: convoPager } = usePager(
    conversations.filter(c => !q || String(c.id).includes(q) || (c.customer || '').toLowerCase().includes(q.toLowerCase())),
    q + section,
  );
  const { shown: shownDocs, pagerProps: docPager } = usePager(
    docs.filter(d => !q || (d.title || '').toLowerCase().includes(q.toLowerCase()) || (d.category || '').toLowerCase().includes(q.toLowerCase())),
    q + section,
  );

  const loadAll = useCallback(async () => {
    try {
      const [m, c, k, s] = await Promise.all([
        adminAiApi.metrics().catch(() => null),
        adminAiApi.listConversations({ per_page: 100 }).catch(() => []),
        adminAiApi.listKnowledge({ per_page: 100 }).catch(() => []),
        adminAiApi.getSettings().catch(() => null),
      ]);
      setMetrics(m?.data ?? m);
      setConversations(asList(c).map(normalizeConversation));
      setDocs(asList(k).map(normalizeDoc));
      const settingsData = s?.data ?? s;
      setSettings(settingsData);
      setSettingsDraft({
        primary_model: settingsData?.primary_model ?? '',
        fallback_model: settingsData?.fallback_model ?? '',
        high_reasoning_model: settingsData?.high_reasoning_model ?? '',
      });
    } catch (error) {
      toast(messageFrom(error));
    } finally {
      setLoaded(true);
    }
  }, [toast]);

  // Initial network hydration is intentionally triggered when the page mounts.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadAll(); }, [loadAll]);

  const openConversation = async (convo) => {
    setConvoDraft({ convo, detail: null, status: convo.status, notes: '' });
    setConvoLoading(true);
    try {
      const detail = await adminAiApi.getConversation(convo.id);
      setConvoDraft(curr => curr && curr.convo.id === convo.id ? {
        ...curr,
        detail,
        status: detail?.status ?? curr.status,
      } : curr);
    } catch (error) {
      toast(messageFrom(error));
    } finally {
      setConvoLoading(false);
    }
  };

  const submitConvoUpdate = async () => {
    if (!convoDraft?.status) return;
    setSaving(true);
    try {
      const updated = await adminAiApi.updateConversation(convoDraft.convo.id, { status: convoDraft.status, notes: convoDraft.notes.trim() || undefined });
      toast('Conversation updated');
      setConvoDraft(curr => curr ? { ...curr, detail: updated ?? curr.detail, notes: '' } : null);
      await loadAll();
    } catch (error) { toast(messageFrom(error)); } finally { setSaving(false); }
  };

  const saveDoc = async () => {
    if (!docDraft?.title.trim() || !docDraft.content.trim()) return;
    setSaving(true);
    const body = {
      title: docDraft.title.trim(),
      content: docDraft.content.trim(),
      slug: docDraft.slug.trim() || undefined,
      category: docDraft.category.trim() || undefined,
    };
    try {
      if (docDraft.id) await adminAiApi.updateKnowledge(docDraft.id, body);
      else await adminAiApi.createKnowledge(body);
      toast(docDraft.id ? 'Document updated' : 'Document added');
      setDocDraft(null);
      await loadAll();
    } catch (error) { toast(messageFrom(error)); } finally { setSaving(false); }
  };

  const removeDoc = async (doc) => {
    if (!window.confirm(`Delete "${doc.title}"?`)) return;
    try {
      await adminAiApi.removeKnowledge(doc.id);
      toast('Document deleted');
      await loadAll();
    } catch (error) { toast(messageFrom(error)); }
  };

  const indexDoc = async (doc) => {
    try {
      await adminAiApi.indexKnowledge(doc.id);
      toast('Indexing queued for ' + doc.title);
      await loadAll();
    } catch (error) { toast(messageFrom(error)); }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await adminAiApi.updateSettings({
        primary_model: settingsDraft.primary_model.trim() || null,
        fallback_model: settingsDraft.fallback_model.trim() || null,
        high_reasoning_model: settingsDraft.high_reasoning_model.trim() || null,
      });
      toast('AI settings updated');
      await loadAll();
    } catch (error) { toast(messageFrom(error)); } finally { setSaving(false); }
  };

  const metricEntries = metrics && typeof metrics === 'object' ? Object.entries(metrics).filter(([, v]) => typeof v === 'number' || typeof v === 'string') : [];

  return (
    <>
      <AdmHead title="Elo AI" sub="Conversations, knowledge base and model settings for the shopping assistant.">
        {section === 'knowledge' && <button className="adm-btn primary" onClick={() => setDocDraft({ id: null, title: '', slug: '', category: '', content: '' })}><Icon name="plus" size={15} /> Add document</button>}
      </AdmHead>

      {metricEntries.length > 0 && (
        <div className="kpi-grid" style={{ marginBottom: 18 }}>
          {metricEntries.slice(0, 4).map(([k, v]) => (
            <div key={k} className="cat-kpis" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '15px 17px' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 12.5, fontFamily: 'var(--font-display)', fontWeight: 600 }}>{humanize(k)}</span>
              <b style={{ fontSize: 21, fontFamily: 'var(--font-display)' }}>{v}</b>
            </div>
          ))}
        </div>
      )}

      <div className="adm-filters">
        {SECTIONS.map(([key, label]) => (
          <button key={key} className={'adm-chip' + (section === key ? ' on' : '')} onClick={() => setSection(key)}>{label}</button>
        ))}
        {section !== 'settings' && (
          <div className="adm-mini-search" style={{ marginLeft: 'auto' }}>
            <Icon name="search" size={15} className="muted" />
            <input placeholder={section === 'conversations' ? 'Search conversations…' : 'Search knowledge base…'} value={q} onChange={e => setQ(e.target.value)} />
          </div>
        )}
      </div>

      {section === 'conversations' && (
        <div className="panel" style={{ padding: 0 }}>
          {!loaded ? <div className="adm-soon"><p>Loading conversations…</p></div> : (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead><tr><th>Conversation</th><th>Customer</th><th>Channel</th><th>Date</th><th>Status</th><th></th></tr></thead>
                <tbody>{shownConvos.map(c => (
                  <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => openConversation(c)}>
                    <td><b style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13.5 }}>#{c.id}</b></td>
                    <td>
                      <div>{c.customer}</div>
                      {c.email && <small className="muted">{c.email}</small>}
                    </td>
                    <td className="muted" style={{ textTransform: 'capitalize' }}>{c.channel || '—'}</td>
                    <td className="muted">{fmtDate(c.date)}</td>
                    <td><span className={'adm-pill ' + (CONVO_STATUS_CLS[c.status] || 'muted')}>{c.status.replace(/_/g, ' ')}</span></td>
                    <td onClick={e => e.stopPropagation()}><div className="adm-rowact">
                      <button title="View conversation" onClick={() => openConversation(c)}><Icon name="eye" size={15} /></button>
                    </div></td>
                  </tr>
                ))}</tbody>
              </table>
              {shownConvos.length === 0 && <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-faint)' }}>No conversations match your filter.</div>}
              <Pager {...convoPager} />
            </div>
          )}
        </div>
      )}

      {section === 'knowledge' && (
        <div className="panel cat-panel">
          {!loaded ? <div className="adm-soon"><p>Loading knowledge base…</p></div> : shownDocs.length === 0 ? (
            <div className="adm-soon"><div className="as-ic"><Icon name="edit" size={26} /></div><h3>No knowledge documents match</h3><p>Add one so Elo can ground its answers in real store policy and info.</p></div>
          ) : shownDocs.map(doc => (
            <div className="cat-parent-row" key={doc.id}>
              <div className="cat-icon"><Icon name="edit" size={19} /></div>
              <div className="cat-main"><b>{doc.title}</b><small>{[doc.category, doc.slug].filter(Boolean).join(' · ')}</small></div>
              <span className={'adm-pill ' + (doc.indexed ? 'ok' : 'muted')}>{doc.indexed ? 'Indexed' : 'Not indexed'}</span>
              <div className="adm-rowact">
                <button title="Index now" onClick={() => indexDoc(doc)}><Icon name="refresh" size={15} /></button>
                <button title="Edit document" onClick={() => setDocDraft(doc)}><Icon name="edit" size={15} /></button>
                <button className="del" title="Delete document" onClick={() => removeDoc(doc)}><Icon name="trash" size={15} /></button>
              </div>
            </div>
          ))}
          {loaded && docs.length > 0 && <Pager {...docPager} />}
        </div>
      )}

      {section === 'settings' && settingsDraft && (
        <div className="panel" style={{ padding: 20 }}>
          <p className="muted" style={{ marginBottom: 16, fontSize: 13.5 }}>Model identifiers are provider-specific strings (e.g. a model name/version) — leave blank to use the backend&apos;s default.</p>
          <label className="adm-field" style={{ marginBottom: 14 }}><span>Primary model</span><input value={settingsDraft.primary_model} onChange={e => setSettingsDraft(c => ({ ...c, primary_model: e.target.value }))} placeholder="Default" /></label>
          <label className="adm-field" style={{ marginBottom: 14 }}><span>Fallback model</span><input value={settingsDraft.fallback_model} onChange={e => setSettingsDraft(c => ({ ...c, fallback_model: e.target.value }))} placeholder="Default" /></label>
          <label className="adm-field" style={{ marginBottom: 18 }}><span>High-reasoning model</span><input value={settingsDraft.high_reasoning_model} onChange={e => setSettingsDraft(c => ({ ...c, high_reasoning_model: e.target.value }))} placeholder="Default" /></label>
          <button className="adm-btn primary" onClick={saveSettings} disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button>
        </div>
      )}

      {convoDraft && (
        <Drawer title={`Conversation · #${convoDraft.convo.id}`} saving={saving} canSave={!!convoDraft.status} onClose={() => setConvoDraft(null)} onSave={submitConvoUpdate} saveLabel="Update status">
          <div className="adm-list" style={{ marginBottom: 4 }}>
            <div className="adm-li"><div className="adm-li-main"><b>Customer</b><small>{convoDraft.convo.customer}{convoDraft.convo.email ? ` · ${convoDraft.convo.email}` : ''}</small></div></div>
            <div className="adm-li"><div className="adm-li-main"><b>Channel</b><small style={{ textTransform: 'capitalize' }}>{convoDraft.detail?.channel || convoDraft.convo.channel || 'web'}</small></div></div>
          </div>

          <div className="adm-field">
            <span>Conversation messages</span>
            {convoLoading ? (
              <div className="adm-note">Loading conversation transcript…</div>
            ) : (convoDraft.detail?.messages || []).length === 0 ? (
              <div className="adm-note">No messages recorded in this conversation yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 340, overflowY: 'auto', padding: '10px', background: 'var(--surface-2)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
                {(convoDraft.detail?.messages || []).map((msg, idx) => {
                  const isUser = String(msg.role || '').toLowerCase() === 'user';
                  return (
                    <div
                      key={msg.id || idx}
                      style={{
                        alignSelf: isUser ? 'flex-end' : 'flex-start',
                        maxWidth: '88%',
                        background: isUser ? 'var(--primary)' : 'var(--surface)',
                        color: isUser ? '#fff' : 'var(--text)',
                        border: isUser ? 'none' : '1px solid var(--border)',
                        borderRadius: 12,
                        padding: '9px 12px',
                        fontSize: 13.5,
                        lineHeight: 1.45,
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700, opacity: isUser ? 0.85 : 0.65, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                        {isUser ? 'Customer' : (msg.role || 'Elo AI')}
                      </div>
                      <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.content || ''}</div>
                      {msg.created_at && (
                        <div style={{ fontSize: 10.5, opacity: 0.7, marginTop: 4 }}>{fmtDate(msg.created_at)}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {(convoDraft.detail?.context?.admin_notes || []).length > 0 && (
            <div className="adm-field">
              <span>Admin notes history</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {convoDraft.detail.context.admin_notes.map((n, i) => (
                  <div key={i} className="adm-note" style={{ flexDirection: 'column', gap: 2 }}>
                    <span>{n.note}</span>
                    {n.created_at && <small className="muted">{fmtDate(n.created_at)}</small>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <label className="adm-field"><span>Status</span>
            <select value={convoDraft.status} onChange={e => setConvoDraft(c => ({ ...c, status: e.target.value }))}>
              {CONVO_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </label>
          <label className="adm-field"><span>Add admin note (optional)</span><textarea rows="2" value={convoDraft.notes} onChange={e => setConvoDraft(c => ({ ...c, notes: e.target.value }))} placeholder="Internal note about this conversation…" /></label>
        </Drawer>
      )}

      {docDraft && (
        <Drawer title={docDraft.id ? 'Edit document' : 'Add document'} saving={saving} canSave={!!(docDraft.title.trim() && docDraft.content.trim())} onClose={() => setDocDraft(null)} onSave={saveDoc} saveLabel={docDraft.id ? 'Save changes' : 'Add document'}>
          <label className="adm-field"><span>Title</span><input value={docDraft.title} onChange={e => setDocDraft(c => ({ ...c, title: e.target.value }))} placeholder="e.g. Return policy" autoFocus /></label>
          <div className="adm-field-row">
            <label className="adm-field"><span>Slug (optional)</span><input value={docDraft.slug} onChange={e => setDocDraft(c => ({ ...c, slug: e.target.value }))} /></label>
            <label className="adm-field"><span>Category (optional)</span><input value={docDraft.category} onChange={e => setDocDraft(c => ({ ...c, category: e.target.value }))} /></label>
          </div>
          <label className="adm-field"><span>Content</span><textarea rows="8" value={docDraft.content} onChange={e => setDocDraft(c => ({ ...c, content: e.target.value }))} placeholder="What should Elo know?" /></label>
        </Drawer>
      )}
    </>
  );
}
