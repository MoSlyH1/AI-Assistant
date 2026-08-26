'use client';

import { useEffect, useRef, useState } from 'react';

const ZONES = ['UTC', 'Europe/London', 'America/New_York', 'Asia/Dubai', 'Asia/Tokyo'];
const PRESETS = [1, 5, 10, 25, 45];

function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, now + i * 0.45);
      gain.gain.exponentialRampToValueAtTime(0.28, now + i * 0.45 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.45 + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.45);
      osc.stop(now + i * 0.45 + 0.32);
    }
    setTimeout(() => ctx.close(), 2000);
  } catch { /* audio is a nicety, not a requirement */ }
}

const two = (n) => String(n).padStart(2, '0');

export default function Clock({ tz }) {
  const [now, setNow] = useState(null);
  const [left, setLeft] = useState(0);          // milliseconds remaining
  const [running, setRunning] = useState(false);
  const [rang, setRang] = useState(false);
  const [zone, setZone] = useState(tz);
  const [saved, setSaved] = useState(false);
  const target = useRef(0);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => {
      const remaining = Math.max(0, target.current - Date.now());
      setLeft(remaining);
      if (remaining === 0) { setRunning(false); setRang(true); beep(); }
    }, 200);
    return () => clearInterval(id);
  }, [running]);

  function startMinutes(min) {
    target.current = Date.now() + min * 60000;
    setLeft(min * 60000);
    setRang(false);
    setRunning(true);
  }

  function toggle() {
    if (running) { setRunning(false); return; }
    if (left > 0) { target.current = Date.now() + left; setRunning(true); }
  }

  async function saveZone() {
    await fetch('/api/me', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tz: zone }),
    });
    setSaved(true);
    setTimeout(() => window.location.reload(), 600);
  }

  const totalSec = Math.ceil(left / 1000);
  const t = { h: Math.floor(totalSec / 3600), m: Math.floor((totalSec % 3600) / 60), s: totalSec % 60 };

  const hhmmss = now
    ? new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now)
    : '--:--:--';
  const [hh, mm, ss] = hhmmss.split(':');

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">{tz}</div>
          <h1>Clock</h1>
        </div>
      </div>

      <div className="card">
        <div className="bigclock">{hh}:{mm}<span className="sec">:{ss}</span></div>
        <div className="task-meta" style={{ marginTop: 8 }}>
          {now ? new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now) : ''}
        </div>
      </div>

      <div className="clock-grid">
        {ZONES.filter((z) => z !== tz).map((z) => (
          <div key={z} className="card zone">
            <div className="zone-name">{z.split('/').pop().replace('_', ' ')}</div>
            <div className="zone-time">
              {now ? new Intl.DateTimeFormat('en-GB', { timeZone: z, hour: '2-digit', minute: '2-digit', hour12: false }).format(now) : '--:--'}
            </div>
          </div>
        ))}
      </div>

      <div className="daygroup">Timer</div>
      <div className="card">
        <div className="timer-face" style={{ color: rang ? 'var(--amber)' : 'var(--text)' }}>
          {two(t.h)}:{two(t.m)}:{two(t.s)}
        </div>
        {rang && <div className="task-meta" style={{ color: 'var(--amber)', marginTop: 6 }}>Time is up.</div>}
        <div className="timer-btns">
          {PRESETS.map((p) => (
            <button key={p} className="preset" onClick={() => startMinutes(p)}>{p} min</button>
          ))}
        </div>
        <div className="timer-btns">
          <button className="btn" onClick={toggle} disabled={left === 0}>{running ? 'Pause' : 'Resume'}</button>
          <button className="btn ghost" onClick={() => { setRunning(false); setLeft(0); setRang(false); }}>Reset</button>
        </div>
      </div>

      <div className="daygroup">Your timezone</div>
      <div className="card">
        <p className="hint" style={{ marginTop: 0 }}>
          Everything you schedule is stored in real time and shown in this zone.
        </p>
        <div className="inline-form" style={{ marginBottom: 0, marginTop: 12 }}>
          <input className="input" value={zone} onChange={(e) => setZone(e.target.value)}
            placeholder="Asia/Beirut" aria-label="Timezone" />
          <button className="btn" onClick={saveZone}>{saved ? 'Saved' : 'Save timezone'}</button>
          <button className="btn ghost" onClick={() => setZone(Intl.DateTimeFormat().resolvedOptions().timeZone)}>
            Use this device
          </button>
        </div>
      </div>
    </div>
  );
}
