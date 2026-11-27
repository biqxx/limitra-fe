'use client';
/* Shared in-app chat thread UI — used by both the customer-facing MicroStore
   storefront ("Chat with Store") and the owner-facing dashboard ("Messages").
   Every chat endpoint is undocumented at the field level, so messages are
   read defensively and "mine" is computed by comparing each message's
   sender id against the viewer's own logged-in user id, rather than
   trusting a sender_type-style flag that may not exist. */
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/icons/Icon';

export function pickMsgList(res) {
  if (Array.isArray(res)) return res;
  for (const k of ['messages', 'chat_messages', 'thread', 'data']) {
    if (Array.isArray(res?.[k])) return res[k];
  }
  return [];
}

export function normalizeChatMessage(m, meId) {
  const senderId = m?.sender_id ?? m?.user_id ?? m?.author_id ?? m?.sender?.id;
  return {
    id: m?.id ?? `${Math.random()}`,
    text: m?.body ?? m?.message ?? m?.text ?? m?.content ?? '',
    mine: meId != null && senderId != null && String(senderId) === String(meId),
    date: m?.created_at ?? m?.date ?? null,
  };
}

export function ChatThread({ messages, onSend, sending, placeholder = 'Type a message…' }) {
  const [text, setText] = useState('');
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }); }, [messages.length]);

  const submit = (e) => {
    e.preventDefault();
    const v = text.trim();
    if (!v || sending) return;
    onSend(v);
    setText('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 2px' }}>
        {messages.length === 0 && <p className="muted" style={{ textAlign: 'center', padding: 20 }}>No messages yet — say hello!</p>}
        {messages.map((m) => (
          <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: m.mine ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '78%',
              background: m.mine ? 'var(--primary)' : 'var(--surface-2)',
              color: m.mine ? '#fff' : 'inherit',
              borderRadius: 'var(--r-md)',
              padding: '8px 12px',
              fontSize: 13.5,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>{m.text}</div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form onSubmit={submit} className="row" style={{ gap: 8, marginTop: 10, flex: 'none' }}>
        <input className="input" style={{ flex: 1 }} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} />
        <button className="adm-btn primary" type="submit" disabled={!text.trim() || sending} aria-label="Send"><Icon name="send" size={15} /></button>
      </form>
    </div>
  );
}
