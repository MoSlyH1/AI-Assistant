import { one, q } from './db.js';
import { isValidTz } from './time.js';

/**
 * Single-user app: no accounts, no sessions. There's exactly one settings
 * row (id=1) that holds the timezone. getSettings() creates it on first
 * use so nothing ever 404s just because migrate hasn't run insert-seed.
 */
export async function getSettings() {
  const row = await one('SELECT tz FROM settings WHERE id = 1');
  if (row) return row;
  await q('INSERT INTO settings (id, tz) VALUES (1, $1) ON CONFLICT (id) DO NOTHING', ['UTC']);
  return { tz: 'UTC' };
}

export async function setTimezone(tz) {
  if (!isValidTz(tz)) return getSettings();
  const row = await one(
    'INSERT INTO settings (id, tz) VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET tz = $1 RETURNING tz',
    [tz]
  );
  return row;
}

export function jsonError(err) {
  const status = err?.status || 500;
  const message = status === 500 ? 'Something broke on the server.' : err.message;
  if (status === 500) console.error(err);
  return Response.json({ error: message }, { status });
}
