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
    if (typeof body.title === 'string') { fields.push(`title = $${i++}`); values.push(body.title.slice(0, 200)); }
    if (typeof body.location === 'string') { fields.push(`location = $${i++}`); values.push(body.location.slice(0, 200)); }
    if (body.start_at) { fields.push(`start_at = $${i++}`); values.push(localToUtc(body.start_at, tz)); }
    if (body.end_at) { fields.push(`end_at = $${i++}`); values.push(localToUtc(body.end_at, tz)); }
    if (!fields.length) throw bad('Nothing to update.');
    values.push(Number(id));
    const row = await one(`UPDATE events SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`, values);
    if (!row) throw bad('Event not found.', 404);
    return Response.json({ event: row });
  } catch (err) { return jsonError(err); }
}

export async function DELETE(_req, { params }) {
  try {
    const { id } = await params;
    const row = await one('DELETE FROM events WHERE id = $1 RETURNING id', [Number(id)]);
    if (!row) throw bad('Event not found.', 404);
    return Response.json({ ok: true });
  } catch (err) { return jsonError(err); }
}
