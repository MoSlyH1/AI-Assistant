'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import DayRail from './DayRail';

const STARTERS = [
  'What is physics?',
  'add task pay the internet bill friday 6pm',
  'note: ideas for the Flutter side project',
  'image of a cedar tree over Beirut at sunset',
];
const STORAGE_KEY = 'nimbus-chat-v2';

export default function Chat({ tz, provider }) {
  const [messages, setMessages] = useState([]);
  const [events, setEvents] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const bottom = useRef(null);
  const box = useRef(null);

  const loadEvents = useCallback(async () => {
    try {
      const r = await fetch('/api/events', { cache: 'no-store' });
      if (r.ok) setEvents((await r.json()).events || []);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (Array.isArray(saved)) setMessages(saved.slice(-100));
    } catch {}
    setLoaded(true);
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-100))); } catch {}
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loaded, busy]);

  function clearChat() {
    setMessages([]);
    setError('');
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }

  async function send(value) {
    const outgoing = (value ?? text).trim();
    if (!outgoing || busy) return;
    if (/^(clear|clear chat|clear messages|reset chat|reset conversation)$/i.test(outgoing)) { clearChat(); setText(''); return; }
    setError('');
    setText('');
    if (box.current) box.current.style.height = 'auto';
    const userMessage = { id: `u-${Date.now()}`, role: 'user', content: outgoing, created_at: new Date().toISOString() };
    const next = [...messages, userMessage].slice(-100);
    setMessages(next);
    setBusy(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: outgoing,
          history: next.slice(-12).filter((m) => m.role === 'user' || m.role === 'assistant').map((m) => ({ role: m.role, content: m.content })),
          tz,
        }),
      });
      const raw = await res.text();
      let data;
      try { data = JSON.parse(raw); } catch { throw new Error(`Server returned an invalid response (${res.status}).`); }
      if (!res.ok) throw new Error(data.error || 'That did not go through.');
      setMessages((m) => [...m, { ...data.message, receipts: data.actionResults, degraded: data.degraded }].slice(-100));
      if (data.changed) loadEvents();
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  function grow(e) {
    setText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 168)}px`;
  }

  return (
    <>
      <div className="chat-scroll">
        <div className="chat-inner">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <button className="btn ghost" onClick={clearChat} disabled={!messages.length}>Clear chat</button>
          </div>
          <DayRail events={events} tz={tz} />

          {loaded && !messages.length && (
            <div className="empty-hero">
              <h2>What can I help you with?</h2>
              <p>Ask general questions, manage your tasks and notes, schedule events, use the timer, or generate an image.</p>
              <div className="starters" style={{ justifyContent: 'center' }}>
                {STARTERS.map((s) => <button key={s} className="starter" onClick={() => send(s)}>{s}</button>)}
              </div>
              {provider === 'offline' && <p className="hint" style={{ marginTop: 20 }}>Add GEMINI_API_KEY in Vercel to enable general AI questions.</p>}
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={`bubble ${m.role === 'user' ? 'me' : 'bot'}`}>
              {m.content}
              {m.image_url && <img src={m.image_url} alt="Generated image" loading="lazy" />}
              {m.receipts?.length > 0 && <div className="receipt">{m.receipts.map((r, i) => <span key={i} className={`chip${/^No |Could not|Skipped/.test(r) ? ' warn' : ''}`}>{r}</span>)}</div>}
              {m.degraded && <div className="receipt"><span className="chip warn">AI unavailable</span></div>}
            </div>
          ))}

          {busy && <div className="bubble bot dots"><span /><span /><span /></div>}
          {error && <div className="alert">{error}</div>}
          <div ref={bottom} />
        </div>
      </div>

      <div className="composer">
        <div className="composer-inner">
          <textarea ref={box} value={text} onChange={grow} onKeyDown={onKey} rows={1} placeholder="Ask anything, or tell me what to file…" aria-label="Message Nimbus" />
          <button className="send" onClick={() => send()} disabled={busy || !text.trim()}>Send</button>
        </div>
      </div>
    </>
  );
}
