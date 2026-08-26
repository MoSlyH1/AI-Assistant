'use client';

import { useEffect, useState } from 'react';
import DayRail from './DayRail';

function fmt(iso, tz, opts) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, ...opts }).format(new Date(iso));
}

export default function Schedule({ tz }) {
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState({ title: '', start_at: '', end_at: '', location: '' });
  const [error, setError] = useState('');

  async function load() {
    const r = await fetch('/api/events');
    if (r.ok) setEvents((await r.json()).events || []);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    setError('');
    if (!form.title.trim() || !form.start_at) { setError('An event needs a title and a start time.'); return; }
    const r = await fetch('/api/events', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    if (!r.ok) { setError((await r.json()).error); return; }
    setForm({ title: '', start_at: '', end_at: '', location: '' });
    load();
  }

  async function remove(id) {
    setEvents((list) => list.filter((e) => e.id !== id));
    await fetch(`/api/events/${id}`, { method: 'DELETE' });
  }

  const upcoming = events.filter((e) => new Date(e.end_at) >= new Date());
  const groups = [];
  for (const e of upcoming) {
    const key = fmt(e.start_at, tz, { weekday: 'long', day: 'numeric', month: 'long' });
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(e);
    else groups.push({ key, items: [e] });
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">{upcoming.length} upcoming</div>
          <h1>Schedule</h1>
        </div>
      </div>

      <DayRail events={events} tz={tz} />

      {error && <div className="alert">{error}</div>}

      <div className="inline-form">
        <input className="input" placeholder="Event title" value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <input className="input" type="datetime-local" style={{ maxWidth: 210 }} value={form.start_at}
          onChange={(e) => setForm({ ...form, start_at: e.target.value })} aria-label="Starts" />
        <input className="input" type="datetime-local" style={{ maxWidth: 210 }} value={form.end_at}
          onChange={(e) => setForm({ ...form, end_at: e.target.value })} aria-label="Ends" />
        <input className="input" placeholder="Where" style={{ maxWidth: 170 }} value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })} />
        <button className="btn" onClick={add}>Add event</button>
      </div>

      {groups.map((g) => (
        <div key={g.key}>
          <div className="daygroup">{g.key}</div>
          <div className="stack">
            {g.items.map((e) => (
              <div key={e.id} className="ev">
                <div className="ev-time">{fmt(e.start_at, tz, { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
                <div className="grow">
                  <div className="task-title">{e.title}</div>
                  <div className="task-meta">
                    until {fmt(e.end_at, tz, { hour: '2-digit', minute: '2-digit', hour12: false })}
                    {e.location ? ` · ${e.location}` : ''}
                  </div>
                </div>
                <button className="x" onClick={() => remove(e.id)} aria-label="Delete event">×</button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {!upcoming.length && (
        <div className="blank">
          <strong>Nothing scheduled</strong>
          Add an event above, or say &quot;schedule standup tomorrow 9am&quot;.
        </div>
      )}
    </div>
  );
}
