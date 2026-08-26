'use client';

import { useEffect, useState } from 'react';

export default function Notes() {
  const [notes, setNotes] = useState([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // { id?, title, body }

  async function load(term = '') {
    const r = await fetch(`/api/notes${term ? `?q=${encodeURIComponent(term)}` : ''}`);
    if (r.ok) setNotes((await r.json()).notes || []);
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const id = setTimeout(() => load(search), 250);
    return () => clearTimeout(id);
  }, [search]);

  async function save() {
    if (!editing) return;
    const payload = { title: editing.title, body: editing.body };
    if (editing.id) {
      await fetch(`/api/notes/${editing.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
    } else {
      await fetch('/api/notes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
    }
    setEditing(null);
    load(search);
  }

  async function remove(id) {
    await fetch(`/api/notes/${id}`, { method: 'DELETE' });
    setEditing(null);
    load(search);
  }

  async function togglePin(note, e) {
    e.stopPropagation();
    await fetch(`/api/notes/${note.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pinned: !note.pinned }),
    });
    load(search);
  }

  if (editing) {
    return (
      <div className="page">
        <div className="page-head">
          <div>
            <div className="eyebrow">{editing.id ? 'Editing' : 'New note'}</div>
            <h1>{editing.id ? 'Edit note' : 'Write a note'}</h1>
          </div>
        </div>
        <div className="field">
          <label htmlFor="nt">Title</label>
          <input id="nt" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="nb">Body</label>
          <textarea id="nb" rows={14} value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} />
        </div>
        <div className="inline-form">
          <button className="btn" onClick={save}>Save note</button>
          <button className="btn ghost" onClick={() => setEditing(null)}>Cancel</button>
          {editing.id && <button className="btn ghost" onClick={() => remove(editing.id)}>Delete</button>}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">{notes.length} saved</div>
          <h1>Notes</h1>
        </div>
        <button className="btn" onClick={() => setEditing({ title: '', body: '' })}>New note</button>
      </div>

      <div className="inline-form">
        <input className="input" placeholder="Search notes" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="note-grid">
        {notes.map((n) => (
          <div key={n.id} className="note" onClick={() => setEditing({ id: n.id, title: n.title, body: n.body })}>
            <div className="row">
              <h3 className="grow">{n.title}</h3>
              <button className="pin" onClick={(e) => togglePin(n, e)} aria-label={n.pinned ? 'Unpin note' : 'Pin note'}>
                {n.pinned ? '★' : '☆'}
              </button>
            </div>
            <p>{n.body.slice(0, 220)}{n.body.length > 220 ? '…' : ''}</p>
          </div>
        ))}
      </div>
      {!notes.length && (
        <div className="blank">
          <strong>{search ? 'No notes match that' : 'No notes yet'}</strong>
          {search ? 'Try a different word.' : 'Write one, or say "note: …" to the assistant.'}
        </div>
      )}
    </div>
  );
}
