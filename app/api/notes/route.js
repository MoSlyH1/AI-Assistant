import { q, one } from '@/lib/db';
import { jsonError } from '@/lib/settings';
import { readJson } from '@/lib/route-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const search = new URL(req.url).searchParams.get('q');
    const rows = search
      ? await q(
          `SELECT * FROM notes WHERE title ILIKE $1 OR body ILIKE $1 ORDER BY pinned DESC, updated_at DESC`,
          [`%${search}%`]
        )
      : await q('SELECT * FROM notes ORDER BY pinned DESC, updated_at DESC');
    return Response.json({ notes: rows });
  } catch (err) { return jsonError(err); }
}

export async function POST(req) {
  try {
    const body = await readJson(req);
    const text = String(body.body || '').slice(0, 20000);
    const title = String(body.title || '').trim().slice(0, 160) || text.split('\n')[0].slice(0, 60) || 'Untitled';
    const row = await one('INSERT INTO notes (title, body) VALUES ($1,$2) RETURNING *', [title, text]);
    return Response.json({ note: row }, { status: 201 });
  } catch (err) { return jsonError(err); }
}
