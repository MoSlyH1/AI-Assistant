'use client';

import { useEffect, useState } from 'react';

function localInputValue(iso, tz) {
  if (!iso) return '';
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(iso)).reduce((a, x) => (x.type !== 'literal' ? { ...a, [x.type]: x.value } : a), {});
  return `${p.year}-${p.month}-${p.day}T${String(Number(p.hour) % 24).padStart(2, '0')}:${p.minute}`;
}

export default function Tasks({ tz }) {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [priority, setPriority] = useState(2);
  const [showDone, setShowDone] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    const r = await fetch('/api/tasks');
    if (r.ok) setTasks((await r.json()).tasks || []);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!title.trim()) return;
    setError('');
    const r = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, due_at: due || null, priority }),
    });
    if (!r.ok) { setError((await r.json()).error); return; }
    setTitle(''); setDue(''); setPriority(2);
    load();
  }

  async function toggle(t) {
    setTasks((list) => list.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)));
    await fetch(`/api/tasks/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done: !t.done }),
    });
    load();
  }

  async function remove(id) {
    setTasks((list) => list.filter((x) => x.id !== id));
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
  }

  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);
  const shown = showDone ? done : open;
  const now = Date.now();

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">{open.length} open · {done.length} done</div>
          <h1>Tasks</h1>
        </div>
        <button className="btn ghost" onClick={() => setShowDone((v) => !v)}>
          {showDone ? 'Show open' : 'Show completed'}
        </button>
      </div>

      {error && <div className="alert">{error}</div>}

      <div className="inline-form">
        <input className="input" placeholder="What needs doing?" value={title}
          onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <input className="input" type="datetime-local" style={{ maxWidth: 210 }}
          value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" />
        <select className="input" style={{ maxWidth: 130 }} value={priority}
          onChange={(e) => setPriority(Number(e.target.value))} aria-label="Priority">
          <option value={1}>Urgent</option>
          <option value={2}>Normal</option>
          <option value={3}>Someday</option>
        </select>
        <button className="btn" onClick={add}>Add task</button>
      </div>

      <div className="stack">
        {shown.map((t) => {
          const late = t.due_at && !t.done && new Date(t.due_at).getTime() < now;
          return (
            <div key={t.id} className={`task p${t.priority}${t.done ? ' is-done' : ''}`}>
              <button className={`tick${t.done ? ' on' : ''}`} onClick={() => toggle(t)}
                aria-label={t.done ? 'Mark as not done' : 'Mark as done'}>{t.done ? '✓' : ''}</button>
              <div className="grow">
                <div className="task-title">{t.title}</div>
                {t.detail && <div className="task-meta">{t.detail}</div>}
                {t.due_at && (
                  <div className={`task-meta${late ? ' late' : ''}`}>
                    {late ? 'Overdue · ' : 'Due '}{localInputValue(t.due_at, tz).replace('T', ' ')}
                  </div>
                )}
              </div>
              <button className="x" onClick={() => remove(t.id)} aria-label="Delete task">×</button>
            </div>
          );
        })}
        {!shown.length && (
          <div className="blank">
            <strong>{showDone ? 'Nothing completed yet' : 'Your list is clear'}</strong>
            {showDone ? 'Finished tasks land here.' : 'Add one above, or just tell the assistant.'}
          </div>
        )}
      </div>
    </div>
  );
}
