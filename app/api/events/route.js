import { q, one } from '@/lib/db';
import { getSettings, jsonError } from '@/lib/settings';
import { localToUtc } from '@/lib/time';
import { readJson, bad } from '@/lib/route-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = await q(
      `SELECT * FROM events WHERE start_at > now() - interval '30 days' ORDER BY start_at ASC`
    );
    return Response.json({ events: rows });
  } catch (err) { return jsonError(err); }
}

export async function POST(req) {
  try {
    const { tz } = await getSettings();
    const body = await readJson(req);
    const title = String(body.title || '').trim().slice(0, 200);
    if (!title) throw bad('An event needs a title.');
    const start = localToUtc(body.start_at, tz);
    if (!start) throw bad('An event needs a valid start time.');
    const end = body.end_at ? localToUtc(body.end_at, tz) : null;
    const safeEnd = end && end > start ? end : new Date(start.getTime() + 3600000);
    const row = await one(
      'INSERT INTO events (title, location, start_at, end_at) VALUES ($1,$2,$3,$4) RETURNING *',
      [title, String(body.location || '').slice(0, 200), start, safeEnd]
    );
    return Response.json({ event: row }, { status: 201 });
  } catch (err) { return jsonError(err); }
}
