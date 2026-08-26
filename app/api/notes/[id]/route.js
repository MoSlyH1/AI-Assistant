import { one } from '@/lib/db';
import { jsonError } from '@/lib/settings';
import { readJson, bad } from '@/lib/route-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req, { params }) {
  try {
    const { id } = await params;
    const body = await readJson(req);
    const fields = ['updated_at = now()'];
    const values = [];
    let i = 1;
    if (typeof body.title === 'string') { fields.push(`title = $${i++}`); values.push(body.title.slice(0, 160) || 'Untitled'); }
    if (typeof body.body === 'string') { fields.push(`body = $${i++}`); values.push(body.body.slice(0, 20000)); }
    if (typeof body.pinned === 'boolean') { fields.push(`pinned = $${i++}`); values.push(body.pinned); }
    values.push(Number(id));
    const row = await one(`UPDATE notes SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`, values);
    if (!row) throw bad('Note not found.', 404);
    return Response.json({ note: row });
  } catch (err) { return jsonError(err); }
}

export async function DELETE(_req, { params }) {
  try {
    const { id } = await params;
    const row = await one('DELETE FROM notes WHERE id = $1 RETURNING id', [Number(id)]);
    if (!row) throw bad('Note not found.', 404);
    return Response.json({ ok: true });
  } catch (err) { return jsonError(err); }
}
