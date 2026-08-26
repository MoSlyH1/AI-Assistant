import { q, one } from '@/lib/db';
import { getSettings, jsonError } from '@/lib/settings';
import { localToUtc } from '@/lib/time';
import { readJson, bad } from '@/lib/route-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = await q(
      `SELECT id, title, detail, due_at, priority, done, created_at
       FROM tasks ORDER BY done ASC, due_at ASC NULLS LAST, priority ASC, id DESC`
    );
    return Response.json({ tasks: rows });
  } catch (err) { return jsonError(err); }
}

export async function POST(req) {
  try {
    const { tz } = await getSettings();
    const body = await readJson(req);
    const title = String(body.title || '').trim().slice(0, 200);
    if (!title) throw bad('A task needs a title.');
    const due = body.due_at ? localToUtc(body.due_at, tz) : null;
    const priority = [1, 2, 3].includes(Number(body.priority)) ? Number(body.priority) : 2;
    const row = await one(
      'INSERT INTO tasks (title, detail, due_at, priority) VALUES ($1,$2,$3,$4) RETURNING *',
      [title, String(body.detail || '').slice(0, 2000), due, priority]
    );
    return Response.json({ task: row }, { status: 201 });
  } catch (err) { return jsonError(err); }
}
