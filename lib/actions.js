import { q, one } from './db.js';
import { localToUtc, utcToLocalString } from './time.js';
import { imageUrl } from './ai.js';

/** Everything the model can see, in local wall-clock time. */
export async function buildContext(tz) {
  const zone = tz || 'UTC';
  const [tasks, events, notes] = await Promise.all([
    q('SELECT id, title, due_at, done, priority FROM tasks ORDER BY done, due_at NULLS LAST, id DESC LIMIT 40'),
    q(`SELECT id, title, start_at, location FROM events WHERE end_at > now() - interval '1 day' ORDER BY start_at LIMIT 25`),
    q('SELECT id, title FROM notes ORDER BY updated_at DESC LIMIT 15'),
  ]);
  return {
    tz: zone,
    nowLocal: utcToLocalString(new Date(), zone),
    tasks: tasks.map((t) => ({ ...t, due_local: t.due_at ? utcToLocalString(t.due_at, zone) : null })),
    events: events.map((e) => ({ ...e, start_local: utcToLocalString(e.start_at, zone) })),
    notes,
  };
}

const clampPriority = (p) => (p === 1 || p === 3 ? p : 2);
const str = (v, max = 500) => String(v ?? '').trim().slice(0, max);

/**
 * Runs the model's actions. Each one is independent: a bad action is
 * reported and skipped, it never aborts the rest.
 * Returns { results: string[], image: string|null }
 */
export async function runActions(tz, actions) {
  const zone = tz || 'UTC';
  const results = [];
  let image = null;

  for (const a of (actions || []).slice(0, 12)) {
    try {
      switch (a.type) {
        case 'add_task': {
          const title = str(a.title, 200);
          if (!title) break;
          const due = a.due_at ? localToUtc(a.due_at, zone) : null;
          const row = await one(
            'INSERT INTO tasks (title, detail, due_at, priority) VALUES ($1,$2,$3,$4) RETURNING id, title',
            [title, str(a.detail, 2000), due, clampPriority(a.priority)]
          );
          results.push(`Task added: ${row.title}`);
          break;
        }
        case 'complete_task': {
          const row = await one(
            `UPDATE tasks SET done = true, completed_at = now()
             WHERE id = (SELECT id FROM tasks WHERE done = false AND title ILIKE $1 ORDER BY id LIMIT 1)
             RETURNING title`,
            [`%${str(a.match, 120)}%`]
          );
          results.push(row ? `Completed: ${row.title}` : `No open task matching "${str(a.match, 60)}"`);
          break;
        }
        case 'delete_task': {
          const row = await one(
            `DELETE FROM tasks WHERE id = (SELECT id FROM tasks WHERE title ILIKE $1 ORDER BY id LIMIT 1) RETURNING title`,
            [`%${str(a.match, 120)}%`]
          );
          results.push(row ? `Deleted task: ${row.title}` : `No task matching "${str(a.match, 60)}"`);
          break;
        }
        case 'add_note': {
          const body = str(a.body, 20000);
          const title = str(a.title, 160) || body.split('\n')[0].slice(0, 60) || 'Untitled';
          if (!body && !title) break;
          await one('INSERT INTO notes (title, body) VALUES ($1,$2) RETURNING id', [title, body]);
          results.push(`Note saved: ${title}`);
          break;
        }
        case 'add_event': {
          const title = str(a.title, 200);
          const start = localToUtc(a.start_at, zone);
          if (!title || !start) { results.push('Skipped an event with no valid start time'); break; }
          const end = a.end_at ? localToUtc(a.end_at, zone) : null;
          const safeEnd = end && end > start ? end : new Date(start.getTime() + 3600000);
          await one(
            'INSERT INTO events (title, location, start_at, end_at) VALUES ($1,$2,$3,$4) RETURNING id',
            [title, str(a.location, 200), start, safeEnd]
          );
          results.push(`Scheduled: ${title}`);
          break;
        }
        case 'delete_event': {
          const row = await one(
            `DELETE FROM events WHERE id = (SELECT id FROM events WHERE title ILIKE $1 ORDER BY start_at LIMIT 1) RETURNING title`,
            [`%${str(a.match, 120)}%`]
          );
          results.push(row ? `Removed from schedule: ${row.title}` : `No event matching "${str(a.match, 60)}"`);
          break;
        }
        case 'image': {
          const prompt = str(a.prompt, 400);
          if (prompt) image = imageUrl(prompt);
          break;
        }
        default:
          break;
      }
    } catch (err) {
      console.error('[nimbus] action failed', a?.type, err.message);
      results.push(`Could not complete a ${a?.type || 'unknown'} action`);
    }
  }
  return { results, image };
}
