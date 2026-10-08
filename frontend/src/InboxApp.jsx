import React, { useState, useEffect, useMemo, useRef } from 'react';

// The admin's phone-friendly customer chat. Installable to the home screen and able to receive push notifications.

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
};

const initials = (name) => (name || '?').split(/[\s._-]+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?';

const timeLabel = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date(now.getTime() - 86400000);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
};

const QUICK_REPLIES = [
  'Hello! We are checking your shipment with dispatch now.',
  'Your shipment is on schedule.',
  'Delivery is planned for today.',
  'Please send us an alternative phone number.'
];

const STYLES = `
.ib { position: fixed; inset: 0; display: flex; background: #F1F5F9; color: #0F172A; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
.ib * { box-sizing: border-box; }
.ib-list { width: 100%; max-width: 100%; display: flex; flex-direction: column; background: #ffffff; border-right: 1px solid #E2E8F0; min-height: 0; }
.ib-chat { display: none; flex: 1; flex-direction: column; min-width: 0; min-height: 0; background: #F8FAFC; }
.ib.has-active .ib-list { display: none; }
.ib.has-active .ib-chat { display: flex; }
@media (min-width: 900px) {
  .ib-list { width: 360px; max-width: 360px; flex-shrink: 0; }
  .ib-chat, .ib.has-active .ib-chat { display: flex; }
  .ib.has-active .ib-list { display: flex; }
  .ib-back { display: none !important; }
}
.ib-top { display: flex; align-items: center; gap: 10px; padding: 14px 16px; background: #0F172A; color: #ffffff; padding-top: calc(14px + env(safe-area-inset-top)); }
.ib-logo { font-weight: 800; font-style: italic; letter-spacing: 1.5px; font-size: 18px; }
.ib-title { font-size: 15px; font-weight: 600; color: #CBD5E1; flex: 1; }
.ib-icon-btn { background: rgba(255,255,255,0.1); border: none; color: #ffffff; border-radius: 8px; padding: 8px 12px; font-size: 13px; cursor: pointer; font-weight: 600; }
.ib-icon-btn:hover { background: rgba(255,255,255,0.18); }
.ib-icon-btn.on { background: #ffffff; color: #0F172A; }
.ib-search { padding: 12px 16px; border-bottom: 1px solid #F1F5F9; }
.ib-search input { width: 100%; border: 1px solid #E2E8F0; background: #F8FAFC; border-radius: 10px; padding: 11px 14px; font-size: 15px; color: #0F172A; outline: none; }
.ib-search input:focus { border-color: #0F172A; background: #ffffff; }
.ib-conv-list { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; }
.ib-conv { display: flex; gap: 12px; align-items: center; padding: 14px 16px; border-bottom: 1px solid #F1F5F9; cursor: pointer; }
.ib-conv:hover, .ib-conv.active { background: #F1F5F9; }
.ib-avatar { width: 46px; height: 46px; border-radius: 50%; background: #0F172A; color: #ffffff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 15px; flex-shrink: 0; }
.ib-conv-main { flex: 1; min-width: 0; }
.ib-conv-row { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
.ib-conv-name { font-weight: 600; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ib-conv-time { font-size: 12px; color: #64748B; flex-shrink: 0; }
.ib-conv-last { font-size: 14px; color: #64748B; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
.ib-conv.unread .ib-conv-name, .ib-conv.unread .ib-conv-last { color: #0F172A; font-weight: 700; }
.ib-badge { background: #0F172A; color: #ffffff; border-radius: 999px; min-width: 22px; height: 22px; padding: 0 7px; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.ib-empty { padding: 48px 24px; text-align: center; color: #64748B; font-size: 15px; line-height: 1.6; }
.ib-note { margin: 12px 16px 0; padding: 10px 14px; border-radius: 8px; background: #F1F5F9; color: #334155; font-size: 13px; line-height: 1.5; }
.ib-chat-head { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: #ffffff; border-bottom: 1px solid #E2E8F0; padding-top: calc(12px + env(safe-area-inset-top)); }
.ib-back { background: none; border: none; font-size: 24px; line-height: 1; color: #0F172A; cursor: pointer; padding: 4px 8px 4px 0; }
.ib-chat-name { font-weight: 700; font-size: 16px; }
.ib-chat-sub { font-size: 12px; color: #64748B; }
.ib-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 8px; -webkit-overflow-scrolling: touch; }
.ib-bubble { max-width: 82%; padding: 10px 14px; border-radius: 16px; font-size: 15px; line-height: 1.45; white-space: pre-wrap; word-wrap: break-word; }
.ib-bubble.customer { align-self: flex-start; background: #ffffff; border: 1px solid #E2E8F0; border-bottom-left-radius: 4px; }
.ib-bubble.admin { align-self: flex-end; background: #0F172A; color: #ffffff; border-bottom-right-radius: 4px; }
.ib-time { display: block; font-size: 11px; margin-top: 4px; opacity: 0.6; }
.ib-quick { display: flex; gap: 8px; padding: 8px 16px 0; overflow-x: auto; background: #ffffff; border-top: 1px solid #E2E8F0; }
.ib-chip { flex-shrink: 0; background: #F1F5F9; border: 1px solid #E2E8F0; color: #334155; border-radius: 999px; padding: 7px 14px; font-size: 13px; cursor: pointer; white-space: nowrap; }
.ib-chip:hover { background: #E2E8F0; }
.ib-composer { display: flex; gap: 10px; padding: 10px 16px; background: #ffffff; padding-bottom: calc(10px + env(safe-area-inset-bottom)); }
.ib-composer textarea { flex: 1; border: 1px solid #E2E8F0; background: #F8FAFC; border-radius: 22px; padding: 11px 16px; font-size: 15px; font-family: inherit; resize: none; outline: none; max-height: 120px; color: #0F172A; }
.ib-composer textarea:focus { border-color: #0F172A; background: #ffffff; }
.ib-send { background: #0F172A; color: #ffffff; border: none; border-radius: 22px; padding: 0 20px; font-size: 15px; font-weight: 600; cursor: pointer; }
.ib-send:disabled { opacity: 0.45; cursor: default; }
.ib-placeholder { flex: 1; display: flex; align-items: center; justify-content: center; color: #94A3B8; font-size: 15px; }
`;

export default function InboxApp({ user, insiteMessages, API_BASE, onRefresh, onLogout }) {
  const [selectedEmail, setSelectedEmail] = useState('');
  const [search, setSearch] = useState('');
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [pushState, setPushState] = useState('off'); // off | on | unsupported | blocked
  const [note, setNote] = useState('');
  const [installEvent, setInstallEvent] = useState(null);
  const endRef = useRef(null);

  const isStandalone = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;

  // Group the chat messages into one conversation per customer
  const conversations = useMemo(() => {
    const groups = {};
    (insiteMessages || []).forEach(m => {
      const email = (m.customerEmail || '').toLowerCase().trim();
      if (!email) return;
      if (!groups[email]) groups[email] = { email, name: email.split('@')[0], messages: [], unread: 0, last: m };
      const g = groups[email];
      if (m.sender === 'customer' && m.customerName) g.name = m.customerName;
      g.messages.push(m);
      if (m.sender === 'customer' && !m.read) g.unread += 1;
      if (new Date(m.createdAt || 0) > new Date(g.last.createdAt || 0)) g.last = m;
    });
    return Object.values(groups).sort((a, b) => new Date(b.last.createdAt || 0) - new Date(a.last.createdAt || 0));
  }, [insiteMessages]);

  const filtered = conversations.filter(c => {
    const q = search.trim().toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || c.email.includes(q);
  });

  const active = conversations.find(c => c.email === selectedEmail);
  const activeMessages = useMemo(() => active
    ? [...active.messages].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
    : [], [active]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [activeMessages.length, selectedEmail]);

  // Opening a conversation marks the customer's messages as read
  useEffect(() => {
    if (active && active.unread > 0) {
      fetch(`${API_BASE}/insite-messages/read`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerEmail: active.email, reader: 'admin' })
      }).then(() => onRefresh && onRefresh()).catch(() => {});
    }
  }, [active && active.email, active && active.unread]);

  // Register the service worker and check whether this device already gets notifications
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setPushState('unsupported');
      return undefined;
    }
    if (Notification.permission === 'denied') setPushState('blocked');
    navigator.serviceWorker.register('/sw.js').then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      if (sub && Notification.permission === 'granted') {
        setPushState('on');
        // Keep the server's copy fresh (the sign-in token may have been renewed)
        fetch(`${API_BASE}/push/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: sub })
        }).catch(() => {});
      }
    }).catch(() => {});

    const onPrompt = (e) => { e.preventDefault(); setInstallEvent(e); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const enableNotifications = async () => {
    setNote('');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushState('blocked');
        setNote('Notifications are blocked. Allow them for this app in your phone or browser settings, then try again.');
        return;
      }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const keyRes = await fetch(`${API_BASE}/push/public-key`);
      const { key } = await keyRes.json();
      if (!key) {
        setNote('Notifications are not set up on the server yet (the VAPID keys are missing).');
        return;
      }
      const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key)
      });
      const res = await fetch(`${API_BASE}/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub })
      });
      if (!res.ok) throw new Error('Server refused the subscription');
      setPushState('on');
      setNote('Notifications are on. You will be alerted when a customer writes.');
    } catch (err) {
      setNote('Could not turn on notifications. Please try again.');
    }
  };

  const installApp = async () => {
    if (installEvent) {
      installEvent.prompt();
      await installEvent.userChoice.catch(() => {});
      setInstallEvent(null);
    } else {
      setNote('To install: open your browser menu (the three dots) and choose "Add to Home screen" or "Install app".');
    }
  };

  const send = async (text) => {
    const body = (typeof text === 'string' ? text : reply).trim();
    if (!active || !body || sending) return;
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/insite-messages/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerEmail: active.email, customerName: 'TXL Logistics Support', body })
      });
      if (res.ok) {
        setReply('');
        onRefresh && onRefresh();
      }
    } finally {
      setSending(false);
    }
  };

  const totalUnread = conversations.reduce((n, c) => n + c.unread, 0);

  return (
    <div className={`ib ${active ? 'has-active' : ''}`}>
      <style>{STYLES}</style>

      {/* Conversation list */}
      <div className="ib-list">
        <div className="ib-top">
          <span className="ib-logo">TXL</span>
          <span className="ib-title">Inbox{totalUnread > 0 ? ` (${totalUnread})` : ''}</span>
          {pushState !== 'unsupported' && (
            <button className={`ib-icon-btn ${pushState === 'on' ? 'on' : ''}`} onClick={pushState === 'on' ? undefined : enableNotifications}>
              {pushState === 'on' ? 'Alerts on' : 'Turn on alerts'}
            </button>
          )}
          <button className="ib-icon-btn" onClick={onLogout}>Sign out</button>
        </div>

        {!isStandalone && (
          <div className="ib-note">
            Install this as an app for quick access.{' '}
            <button className="ib-chip" style={{ marginLeft: 6 }} onClick={installApp}>Install app</button>
          </div>
        )}
        {pushState === 'unsupported' && (
          <div className="ib-note">This browser cannot show alerts. Open the inbox in Chrome on Android, or add it to the iPhone home screen first.</div>
        )}
        {note && <div className="ib-note">{note}</div>}

        <div className="ib-search">
          <input placeholder="Search customers" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="ib-conv-list">
          {filtered.length === 0 ? (
            <div className="ib-empty">
              {conversations.length === 0
                ? 'No customer messages yet. They appear here as soon as a customer writes in.'
                : 'No customers match your search.'}
            </div>
          ) : filtered.map(c => (
            <div
              key={c.email}
              className={`ib-conv ${c.email === selectedEmail ? 'active' : ''} ${c.unread > 0 ? 'unread' : ''}`}
              onClick={() => setSelectedEmail(c.email)}
            >
              <div className="ib-avatar">{initials(c.name)}</div>
              <div className="ib-conv-main">
                <div className="ib-conv-row">
                  <span className="ib-conv-name">{c.name}</span>
                  <span className="ib-conv-time">{timeLabel(c.last.createdAt)}</span>
                </div>
                <div className="ib-conv-row">
                  <span className="ib-conv-last">{c.last.sender === 'admin' ? 'You: ' : ''}{c.last.body}</span>
                  {c.unread > 0 && <span className="ib-badge">{c.unread}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Open conversation */}
      <div className="ib-chat">
        {active ? (
          <>
            <div className="ib-chat-head">
              <button className="ib-back" onClick={() => setSelectedEmail('')} aria-label="Back to all chats">&#8249;</button>
              <div className="ib-avatar" style={{ width: 40, height: 40, fontSize: 14 }}>{initials(active.name)}</div>
              <div>
                <div className="ib-chat-name">{active.name}</div>
                <div className="ib-chat-sub">{active.email}</div>
              </div>
            </div>

            <div className="ib-messages">
              {activeMessages.map((m, i) => (
                <div key={m._id || i} className={`ib-bubble ${m.sender === 'admin' ? 'admin' : 'customer'}`}>
                  {m.body}
                  <span className="ib-time">{timeLabel(m.createdAt)}</span>
                </div>
              ))}
              <div ref={endRef} />
            </div>

            <div className="ib-quick">
              {QUICK_REPLIES.map(q => (
                <button key={q} className="ib-chip" onClick={() => send(q)}>{q}</button>
              ))}
            </div>
            <div className="ib-composer">
              <textarea
                rows="1"
                placeholder="Write a reply"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
                }}
              />
              <button className="ib-send" disabled={sending || !reply.trim()} onClick={() => send()}>Send</button>
            </div>
          </>
        ) : (
          <div className="ib-placeholder">Select a customer to read and reply</div>
        )}
      </div>
    </div>
  );
}
