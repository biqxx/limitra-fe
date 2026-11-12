'use client';
/* Support Tickets admin — lists/updates tickets (adminSupportTicketsApi) and
   views/replies within a ticket's thread. There's no separate admin "post a
   message" endpoint — staff replies go through the same customer-facing
   supportTicketsApi.message() (components/pages/Account.jsx uses it too),
   the backend presumably distinguishing the sender from the auth'd user.
   Request/response shapes are mostly undocumented (empty `{}` schemas for
   create/message/close; no status/priority enums given anywhere) — every
   read is defensive and the guessed values are a starting point, not a
   confirmed contract. */
import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/components/icons/Icon';
import { adminSupportTicketsApi, supportTicketsApi } from '@/lib/api/endpoints';
import { messageFrom } from '@/lib/api/errors';
import { useAdminToast } from './AdminToastContext';
import { AdmHead } from './AdminShared';

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

const TICKET_STATUSES = ['open', 'pending', 'resolved', 'closed'];
const TICKET_STATUS_CLS = { open: 'info', pending: 'warn', resolved: 'ok', closed: 'muted' };
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

function normalizeTicket(t) {
  return {
    id: t.id,
    subject: t.subject ?? t.title ?? 'Support ticket',
    customer: t.customer_name ?? t.customer?.name ?? t.user?.name
      ?? ([t.user?.first_name, t.user?.last_name].filter(Boolean).join(' ') || 'Customer'),
    status: String(t.status ?? 'open').toLowerCase(),
    priority: t.priority,
    date: t.updated_at ?? t.created_at,
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

function TicketThreadPanel({ ticketId, onBack, onChanged }) {
  const toast = useAdminToast();
  const [ticket, setTicket] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const reload = useCallback(async () => {
    try {
      const res = await supportTicketsApi.get(ticketId);
      setTicket(res?.data ?? res);
    } catch (error) { setTicket(null); }
  }, [ticketId]);

  useEffect(() => { (async () => { await reload(); setLoaded(true); })(); }, [reload]);

  const sendReply = async () => {
    if (!reply.trim() || sending) return;
    setSending(true);
    try {
      await supportTicketsApi.message(ticketId, { message: reply.trim() });
      setReply('');
      await reload();
    } catch (error) { toast(messageFrom(error)); } finally { setSending(false); }
  };

  const closeTicket = async () => {
    try {
      await supportTicketsApi.close(ticketId);
      toast('Ticket closed');
      await reload();
      onChanged();
    } catch (error) { toast(messageFrom(error)); }
  };

  if (!loaded) return <div className="panel"><p className="muted">Loading…</p></div>;
  if (!ticket) return <div className="panel"><p className="muted">Ticket not found.</p></div>;

  const t = normalizeTicket(ticket);
  const messages = ticket.messages ?? ticket.replies ?? [];

  return (
    <div className="panel">
      <div className="row between" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <button className="adm-btn ghost" onClick={onBack}><Icon name="chevleft" size={15} /> All tickets</button>
        {t.status !== 'closed' && <button className="adm-btn ghost" onClick={closeTicket}>Close ticket</button>}
      </div>
      <h3 style={{ marginBottom: 2 }}>{t.subject}</h3>
      <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>#{t.id} · {t.customer} · <span className={'adm-pill ' + (TICKET_STATUS_CLS[t.status] || 'muted')}>{t.status}</span></p>
      {(Array.isArray(messages) ? messages : []).length === 0 ? <p className="muted">No messages yet.</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
          {messages.map((m, i) => {
            const fromStaff = m.is_staff ?? m.from_admin ?? (m.author?.role === 'staff') ?? (m.sender === 'staff');
            return (
              <div key={m.id ?? i} style={{ alignSelf: fromStaff ? 'flex-end' : 'flex-start', maxWidth: '75%', background: fromStaff ? 'var(--primary-soft)' : 'var(--surface-2)', borderRadius: 'var(--r-md)', padding: '10px 14px' }}>
                <p style={{ margin: 0, fontSize: 13.5 }}>{m.message ?? m.body ?? m.text}</p>
                <small className="muted" style={{ fontSize: 11 }}>{fmtDate(m.created_at)}</small>
              </div>
            );
          })}
        </div>
      )}
      {t.status !== 'closed' && (
        <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
          <textarea rows="2" style={{ flex: 1 }} value={reply} onChange={e => setReply(e.target.value)} placeholder="Reply as support…" />
          <button className="adm-btn primary" onClick={sendReply} disabled={sending || !reply.trim()}>{sending ? 'Sending…' : 'Send'}</button>
        </div>
      )}
    </div>
  );
}

export function AdminSupport() {
  const toast = useAdminToast();
  const [tickets, setTickets] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [openTicket, setOpenTicket] = useState(null);
  const [updateDraft, setUpdateDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const res = await adminSupportTicketsApi.list({ per_page: 100 });
      setTickets(asList(res).map(normalizeTicket));
    } catch (error) {
      toast(messageFrom(error));
    } finally {
      setLoaded(true);
    }
  }, [toast]);

  // Initial network hydration is intentionally triggered when the page mounts.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadAll(); }, [loadAll]);

  const submitUpdate = async () => {
    setSaving(true);
    try {
      await adminSupportTicketsApi.update(updateDraft.ticket.id, {
        status: updateDraft.status,
        priority: updateDraft.priority,
        assignee_id: updateDraft.assignee_id ? Number(updateDraft.assignee_id) : null,
      });
      toast('Ticket updated');
      setUpdateDraft(null);
      await loadAll();
    } catch (error) { toast(messageFrom(error)); } finally { setSaving(false); }
  };

  const tabs = ['all', ...TICKET_STATUSES];
  const visible = tickets.filter(t => (status === 'all' || t.status === status) && (!q || String(t.id).includes(q) || t.subject.toLowerCase().includes(q.toLowerCase()) || t.customer.toLowerCase().includes(q.toLowerCase())));

  if (openTicket) {
    return (
      <>
        <AdmHead title="Support Tickets" sub="Viewing a ticket" />
        <TicketThreadPanel ticketId={openTicket} onBack={() => { setOpenTicket(null); loadAll(); }} onChanged={loadAll} />
      </>
    );
  }

  return (
    <>
      <AdmHead title="Support Tickets" sub={`${tickets.length} total tickets`} />
      <div className="adm-filters">
        <div className="adm-mini-search"><Icon name="search" size={16} className="muted" /><input placeholder="Search ticket #, subject or customer…" value={q} onChange={e => setQ(e.target.value)} /></div>
        {tabs.map(t => <button key={t} className={'adm-chip' + (status === t ? ' on' : '')} onClick={() => setStatus(t)}>{t === 'all' ? 'All' : t}</button>)}
      </div>
      <div className="panel" style={{ padding: 0 }}>
        {!loaded ? <div className="adm-soon"><p>Loading tickets…</p></div> : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead><tr><th>Ticket</th><th>Subject</th><th>Customer</th><th>Date</th><th>Priority</th><th>Status</th><th></th></tr></thead>
              <tbody>{visible.map(t => (
                <tr key={t.id}>
                  <td><b style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13.5 }}>#{t.id}</b></td>
                  <td>{t.subject}</td>
                  <td className="muted">{t.customer}</td>
                  <td className="muted">{fmtDate(t.date)}</td>
                  <td className="muted">{t.priority || '—'}</td>
                  <td><span className={'adm-pill ' + (TICKET_STATUS_CLS[t.status] || 'muted')}>{t.status}</span></td>
                  <td><div className="adm-rowact">
                    <button title="View thread" onClick={() => setOpenTicket(t.id)}><Icon name="eye" size={15} /></button>
                    <button title="Update ticket" onClick={() => setUpdateDraft({ ticket: t, status: t.status, priority: t.priority || PRIORITIES[0], assignee_id: '' })}><Icon name="edit" size={15} /></button>
                  </div></td>
                </tr>
              ))}</tbody>
            </table>
            {visible.length === 0 && <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-faint)' }}>No tickets match your filters.</div>}
          </div>
        )}
      </div>

      {updateDraft && (
        <Drawer title={`Update ticket · #${updateDraft.ticket.id}`} saving={saving} canSave={!!updateDraft.status} onClose={() => setUpdateDraft(null)} onSave={submitUpdate} saveLabel="Update ticket">
          <label className="adm-field"><span>Status</span>
            <select value={updateDraft.status} onChange={e => setUpdateDraft(c => ({ ...c, status: e.target.value }))}>
              {TICKET_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="adm-field"><span>Priority</span>
            <select value={updateDraft.priority} onChange={e => setUpdateDraft(c => ({ ...c, priority: e.target.value }))}>
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="adm-field"><span>Assignee user ID (optional)</span><input type="number" min="0" value={updateDraft.assignee_id} onChange={e => setUpdateDraft(c => ({ ...c, assignee_id: e.target.value }))} placeholder="Staff user ID" /></label>
        </Drawer>
      )}
    </>
  );
}
