import { one } from '@/lib/db';
import { getSettings, jsonError } from '@/lib/settings';
import { localToUtc } from '@/lib/time';
import { readJson, bad } from '@/lib/route-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req, { params }) {
  try {
    const { tz } = await getSettings();
    const { id } = await params;
    const body = await readJson(req);
    const fields = [];
    const values = [];
    let i = 1;

    if (typeof body.title === 'string') { fields.push(`title = $${i++}`); values.push(body.title.trim().slice(0, 200)); }
    if (typeof body.detail === 'string') { fields.push(`detail = $${i++}`); values.push(body.detail.slice(0, 2000)); }
    if ('due_at' in body) { fields.push(`due_at = $${i++}`); values.push(body.due_at ? localToUtc(body.due_at, tz) : null); }
    if ([1, 2, 3].includes(Number(body.priority))) { fields.push(`priority = $${i++}`); values.push(Number(body.priority)); }
    if (typeof body.done === 'boolean') {
      fields.push(`done = $${i++}`); values.push(body.done);
      fields.push(`completed_at = ${body.done ? 'now()' : 'NULL'}`);
    }
    if (!fields.length) throw bad('Nothing to update.');

    values.push(Number(id));
    const row = await one(`UPDATE tasks SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`, values);
    if (!row) throw bad('Task not found.', 404);
    return Response.json({ task: row });
  } catch (err) { return jsonError(err); }
}

export async function DELETE(_req, { params }) {
  try {
    const { id } = await params;
    const row = await one('DELETE FROM tasks WHERE id = $1 RETURNING id', [Number(id)]);
    if (!row) throw bad('Task not found.', 404);
    return Response.json({ ok: true });
  } catch (err) { return jsonError(err); }
}
