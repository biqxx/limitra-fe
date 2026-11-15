'use client';

import { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/components/icons/Icon';
import {
  adminCareersApi,
  adminMailLogsApi,
  adminNotificationsApi,
  adminQueuesApi,
  adminSystemApi,
  businessSettingsApi,
} from '@/lib/api/endpoints';
import { messageFrom } from '@/lib/api/errors';
import { useStore } from '@/components/store/StoreProvider';
import { hasPermission } from '@/lib/auth/permissions';
import { useAdminToast } from './AdminToastContext';
import { AdmHead, EmptyState, Pager, SkeletonRows, usePager } from './AdminShared';

const asList = (res) => (Array.isArray(res) ? res : res?.items || res?.data || []);

export function AdminCareers() {
  const { user } = useStore();
  const canManage = hasPermission(user, 'careers.manage');
  const addToast = useAdminToast();
  const [tab, setTab] = useState('jobs');
  const [jobs, setJobs] = useState([]);
  const [apps, setApps] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [jobDraft, setJobDraft] = useState(null);
  const [savingJob, setSavingJob] = useState(false);

  const openJob = async (job) => {
    try {
      const detail = await adminCareersApi.getJob(job.id);
      const j = detail?.job || detail || job;
      setJobDraft({ id: j.id, title: j.title || '', department: j.department || '', location: j.location || 'Remote', employment_type: j.employment_type || 'full_time', description: j.description || '', is_active: j.is_active !== false });
    } catch {
      setJobDraft({ id: job.id, title: job.title || '', department: job.department || '', location: job.location || 'Remote', employment_type: job.employment_type || 'full_time', description: job.description || '', is_active: job.is_active !== false });
    }
  };

  const saveJob = async () => {
    if (!jobDraft?.title.trim()) return;
    setSavingJob(true);
    try {
      const payload = {
        title: jobDraft.title.trim(),
        department: jobDraft.department.trim() || 'Operations',
        location: jobDraft.location.trim() || 'Remote',
        employment_type: jobDraft.employment_type || 'full_time',
        description: jobDraft.description.trim(),
        is_active: Boolean(jobDraft.is_active),
      };
      if (jobDraft.id) await adminCareersApi.updateJob(jobDraft.id, payload);
      else await adminCareersApi.createJob(payload);
      addToast(jobDraft.id ? 'Job updated' : 'Job created');
      setJobDraft(null);
      await load();
    } catch (e) {
      addToast(messageFrom(e));
    } finally {
      setSavingJob(false);
    }
  };

  const load = useCallback(async () => {
    const [jRes, aRes] = await Promise.allSettled([
      adminCareersApi.jobs({ per_page: 100 }),
      adminCareersApi.applications({ per_page: 100 }),
    ]);
    if (jRes.status === 'fulfilled') setJobs(asList(jRes.value));
    if (aRes.status === 'fulfilled') setApps(asList(aRes.value));
    setLoaded(true);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const list = tab === 'jobs' ? jobs : apps;
  const { shown, pagerProps } = usePager(list, tab + list.length);

  return (
    <>
      <AdmHead title="Careers & Applications" sub="Manage open job roles and review incoming candidates.">
        <button className="adm-btn ghost" onClick={load}><Icon name="refresh" size={14} /> Refresh</button>
        {canManage && tab === 'jobs' && (
          <button className="adm-btn primary" onClick={() => setJobDraft({ title: '', department: '', location: 'Remote', employment_type: 'full_time', description: '', is_active: true })}><Icon name="plus" size={15} /> New job</button>
        )}
      </AdmHead>
      <div className="adm-filters">
        <button className={'adm-chip' + (tab === 'jobs' ? ' on' : '')} onClick={() => setTab('jobs')}>Jobs ({jobs.length})</button>
        <button className={'adm-chip' + (tab === 'apps' ? ' on' : '')} onClick={() => setTab('apps')}>Applications ({apps.length})</button>
      </div>
      <div className="panel" style={{ padding: 0 }}>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              {tab === 'jobs'
                ? <tr><th>Title</th><th>Department</th><th>Location</th><th>Status</th><th></th></tr>
                : <tr><th>Applicant</th><th>Role</th><th>Status</th><th>Submitted</th><th></th></tr>}
            </thead>
            <tbody>
              {!loaded ? (
                <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 28 }}>Loading…</td></tr>
              ) : shown.length === 0 ? (
                <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 28 }}>No records found.</td></tr>
              ) : shown.map((it) => tab === 'jobs' ? (
                <tr key={it.id}>
                  <td><b>{it.title}</b></td>
                  <td className="muted">{it.department || '—'}</td>
                  <td className="muted">{it.location || 'Remote'}</td>
                  <td><span className={'adm-pill ' + (it.is_active ? 'ok' : 'muted')}>{it.is_active ? 'Open' : 'Closed'}</span></td>
                  <td>{canManage && (
                    <div className="adm-rowact">
                      <button title="Edit" onClick={() => openJob(it)}><Icon name="edit" size={15} /></button>
                      <button className="del" title="Delete" onClick={async () => { try { await adminCareersApi.removeJob(it.id); addToast('Job removed'); load(); } catch (e) { addToast(messageFrom(e)); } }}><Icon name="trash" size={15} /></button>
                    </div>
                  )}</td>
                </tr>
              ) : (
                <tr key={it.id}>
                  <td><b>{it.full_name || it.name || it.email}</b><small className="muted" style={{ display: 'block' }}>{it.email}</small></td>
                  <td className="muted">{it.job?.title || `Job #${it.job_id}`}</td>
                  <td><span className="adm-pill info">{it.status || 'pending'}</span></td>
                  <td className="muted">{it.created_at ? String(it.created_at).slice(0, 10) : '—'}</td>
                  <td>{canManage && (
                    <div className="adm-rowact">
                      <button title="Download CV" onClick={() => window.open(adminCareersApi.applicationCvUrl(it.id), '_blank', 'noopener')}><Icon name="download" size={15} /></button>
                      <button title="Shortlist" onClick={async () => { try { await adminCareersApi.updateApplicationStatus(it.id, { status: 'shortlisted' }); addToast('Shortlisted'); load(); } catch (e) { addToast(messageFrom(e)); } }}><Icon name="check" size={15} /></button>
                    </div>
                  )}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager {...pagerProps} />
        </div>
      </div>
      {jobDraft && (
        <div className="role-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setJobDraft(null); }}>
          <div className="role-modal">
            <div className="role-modal-h">
              <div><h3 style={{ fontSize: 18 }}>{jobDraft.id ? 'Edit job' : 'New job'}</h3></div>
              <button className="role-modal-x" onClick={() => setJobDraft(null)} aria-label="Close"><Icon name="close" size={18} /></button>
            </div>
            <div className="role-modal-b">
              <label className="adm-field"><span>Job title</span><input value={jobDraft.title} onChange={e => setJobDraft(d => ({ ...d, title: e.target.value }))} /></label>
              <div className="adm-field-row">
                <label className="adm-field"><span>Department</span><input value={jobDraft.department} onChange={e => setJobDraft(d => ({ ...d, department: e.target.value }))} /></label>
                <label className="adm-field"><span>Location</span><input value={jobDraft.location} onChange={e => setJobDraft(d => ({ ...d, location: e.target.value }))} /></label>
              </div>
              <label className="adm-field"><span>Description</span><textarea rows={4} value={jobDraft.description} onChange={e => setJobDraft(d => ({ ...d, description: e.target.value }))} /></label>
              <label className="row" style={{ gap: 8, marginTop: 8 }}>
                <input type="checkbox" checked={jobDraft.is_active} onChange={e => setJobDraft(d => ({ ...d, is_active: e.target.checked }))} />
                <span>Open for applications</span>
              </label>
            </div>
            <div className="role-modal-f">
              <button className="adm-btn ghost" onClick={() => setJobDraft(null)} disabled={savingJob}>Cancel</button>
              <button className="adm-btn primary" onClick={saveJob} disabled={savingJob || !jobDraft.title.trim()}>{savingJob ? 'Saving…' : 'Save job'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function AdminQueues() {
  const { user } = useStore();
  const canRetry = hasPermission(user, 'queue.retry');
  const addToast = useAdminToast();
  const [status, setStatus] = useState(null);
  const [failed, setFailed] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [sRes, fRes] = await Promise.allSettled([adminQueuesApi.status(), adminQueuesApi.failed({ per_page: 100 })]);
    if (sRes.status === 'fulfilled') setStatus(sRes.value);
    if (fRes.status === 'fulfilled') setFailed(asList(fRes.value));
    setLoaded(true);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const { shown, pagerProps } = usePager(failed, failed.length);

  return (
    <>
      <AdmHead title="Queue Monitor" sub="Inspect background worker queues and retry failed jobs.">
        <button className="adm-btn ghost" onClick={load}><Icon name="refresh" size={14} /> Refresh</button>
      </AdmHead>
      {status && (
        <div className="adm-note" style={{ marginBottom: 16 }}>
          <Icon name="info" size={15} /> Worker status: <b>{status.status || status.driver || 'Connected'}</b>
        </div>
      )}
      <div className="panel" style={{ padding: 0 }}>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Job ID</th><th>Queue</th><th>Exception</th><th>Failed at</th><th></th></tr></thead>
            <tbody>
              {!loaded ? (
                <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 28 }}>Loading failed jobs…</td></tr>
              ) : shown.length === 0 ? (
                <tr><td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 28 }}>No failed jobs.</td></tr>
              ) : shown.map((j) => (
                <tr key={j.id || j.uuid}>
                  <td><b>#{j.id || j.uuid}</b></td>
                  <td className="muted">{j.queue || 'default'}</td>
                  <td className="muted" style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.exception || j.payload || '—'}</td>
                  <td className="muted">{j.failed_at ? String(j.failed_at).slice(0, 19) : '—'}</td>
                  <td>{canRetry && (
                    <div className="adm-rowact">
                      <button title="Retry job" onClick={async () => { try { await adminQueuesApi.retry(j.uuid || j.id); addToast('Job queued for retry'); load(); } catch (e) { addToast(messageFrom(e)); } }}><Icon name="refresh" size={15} /></button>
                    </div>
                  )}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager {...pagerProps} />
        </div>
      </div>
    </>
  );
}

export function AdminNotifications() {
  const { user } = useStore();
  const canManage = hasPermission(user, 'notifications.manage');
  const addToast = useAdminToast();
  const [items, setItems] = useState([]);
  const [settings, setSettings] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [nRes, sRes] = await Promise.allSettled([
      adminNotificationsApi.list({ per_page: 100 }),
      canManage ? adminNotificationsApi.settings() : Promise.resolve([]),
    ]);
    if (nRes.status === 'fulfilled') setItems(asList(nRes.value));
    if (sRes.status === 'fulfilled') setSettings(asList(sRes.value));
    setLoaded(true);
  }, [canManage]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const { shown, pagerProps } = usePager(items, items.length);

  return (
    <>
      <AdmHead title="Notifications" sub="Admin alerts and system notification preferences.">
        <button className="adm-btn ghost" onClick={load}><Icon name="refresh" size={14} /> Refresh</button>
        <button className="adm-btn primary" onClick={async () => { try { await adminNotificationsApi.markAllRead(); addToast('All marked as read'); load(); } catch (e) { addToast(messageFrom(e)); } }}>Mark all read</button>
      </AdmHead>
      <div className="panel" style={{ padding: 0 }}>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Notification</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {!loaded ? (
                <tr><td colSpan={3} className="muted" style={{ textAlign: 'center', padding: 28 }}>Loading…</td></tr>
              ) : shown.length === 0 ? (
                <tr><td colSpan={3} className="muted" style={{ textAlign: 'center', padding: 28 }}>No notifications.</td></tr>
              ) : shown.map((n) => (
                <tr key={n.id}>
                  <td><b>{n.title || n.type || 'Notification'}</b><small className="muted" style={{ display: 'block' }}>{n.message || n.body || JSON.stringify(n.data || {})}</small></td>
                  <td><span className={'adm-pill ' + (n.read_at ? 'muted' : 'info')}>{n.read_at ? 'Read' : 'Unread'}</span></td>
                  <td className="muted">{n.created_at ? String(n.created_at).slice(0, 10) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager {...pagerProps} />
        </div>
      </div>
      {canManage && settings.length > 0 && (
        <div className="panel" style={{ marginTop: 18 }}>
          <div className="panel-h"><h3>Notification event settings ({settings.length})</h3></div>
          <div className="adm-list">
            {settings.map((s, i) => (
              <div className="adm-li" key={s.event || i}><div className="adm-li-main"><b>{s.event || s.name}</b><small>{s.description || 'System notification event'}</small></div></div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export function AdminMailLogs() {
  const addToast = useAdminToast();
  const [logs, setLogs] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await adminMailLogsApi.list({ per_page: 100 });
      setLogs(asList(res));
    } catch (err) {
      addToast(messageFrom(err));
    } finally {
      setLoaded(true);
    }
  }, [addToast]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const { shown, pagerProps } = usePager(logs, logs.length);

  return (
    <>
      <AdmHead title="Mail Logs" sub="Inspect outbound transactional emails and previews.">
        <button className="adm-btn ghost" onClick={load}><Icon name="refresh" size={14} /> Refresh</button>
      </AdmHead>
      <div className="panel" style={{ padding: 0 }}>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Subject / Template</th><th>Recipient</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {!loaded ? (
                <tr><td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 28 }}>Loading mail logs…</td></tr>
              ) : shown.length === 0 ? (
                <tr><td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 28 }}>No mail logs available.</td></tr>
              ) : shown.map((m, i) => (
                <tr key={m.id || i}>
                  <td><b>{m.subject || m.mailable || m.template || 'Email'}</b></td>
                  <td className="muted">{m.to || m.recipient || '—'}</td>
                  <td><span className="adm-pill ok">{m.status || 'logged'}</span></td>
                  <td className="muted">{m.created_at ? String(m.created_at).slice(0, 16) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager {...pagerProps} />
        </div>
      </div>
    </>
  );
}

export function AdminSettings() {
  const { user } = useStore();
  const canManage = hasPermission(user, 'settings.manage');
  const addToast = useAdminToast();
  const [health, setHealth] = useState(null);
  const [settings, setSettings] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [historyModal, setHistoryModal] = useState(null);

  const openHistory = async (s) => {
    if (!s.id) { addToast('Setting history requires a setting ID'); return; }
    try {
      const res = await businessSettingsApi.history(s.id);
      setHistoryModal({ setting: s, list: asList(res) });
    } catch (e) {
      addToast(messageFrom(e));
    }
  };

  const load = useCallback(async () => {
    const [hRes, sRes] = await Promise.allSettled([adminSystemApi.health(), businessSettingsApi.list()]);
    if (hRes.status === 'fulfilled') setHealth(hRes.value);
    if (sRes.status === 'fulfilled') {
      const raw = sRes.value;
      const entries = Array.isArray(raw) ? raw : Object.entries(raw || {}).map(([key, value]) => ({ key, value }));
      setSettings(entries);
    }
    setLoaded(true);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const { shown, pagerProps } = usePager(settings, settings.length);

  return (
    <>
      <AdmHead title="System Settings & Health" sub="Inspect platform configuration keys and live backend health.">
        <button className="adm-btn ghost" onClick={load}><Icon name="refresh" size={14} /> Refresh</button>
      </AdmHead>
      {health && (
        <div className="adm-note" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="adm-live-dot" aria-hidden="true" />
          <span>API Health: <b>{health.status || 'healthy'}</b></span>
        </div>
      )}
      <div className="panel" style={{ padding: 0 }}>
        {!loaded ? <SkeletonRows rows={6} /> : shown.length === 0 ? (
          <EmptyState icon="lock" title="No settings returned" description="System configuration keys will appear here when available." />
        ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead><tr><th>Setting key</th><th>Value</th><th>Access</th><th></th></tr></thead>
            <tbody>
              {shown.map((s, i) => (
                <tr key={s.key || i}>
                  <td><b>{s.key}</b></td>
                  <td className="muted">{typeof s.value === 'object' ? JSON.stringify(s.value) : String(s.value ?? '')}</td>
                  <td><span className="adm-pill muted">{canManage ? 'Editable' : 'Read-only'}</span></td>
                  <td>{s.id && <div className="adm-rowact"><button title="History" onClick={() => openHistory(s)}><Icon name="clock" size={15} /></button></div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager {...pagerProps} />
        </div>
        )}
      </div>
      {historyModal && (
        <div className="role-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setHistoryModal(null); }}>
          <div className="role-modal">
            <div className="role-modal-h">
              <div><h3 style={{ fontSize: 18 }}>Setting history</h3><small className="muted">{historyModal.setting.key}</small></div>
              <button className="role-modal-x" onClick={() => setHistoryModal(null)} aria-label="Close"><Icon name="close" size={18} /></button>
            </div>
            <div className="role-modal-b" style={{ maxHeight: 380, overflowY: 'auto' }}>
              {historyModal.list.length === 0 ? <p className="muted">No change history recorded.</p> : (
                <div className="adm-list">
                  {historyModal.list.map((h, idx) => (
                    <div className="adm-li" key={h.id || idx}>
                      <div className="adm-li-main">
                        <b>{String(h.new_value ?? h.value ?? '—')}</b>
                        <small className="muted">{h.created_at ? String(h.created_at).slice(0, 16).replace('T', ' ') : ''}</small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="role-modal-f"><button className="adm-btn ghost" onClick={() => setHistoryModal(null)}>Close</button></div>
          </div>
        </div>
      )}
    </>
  );
}

