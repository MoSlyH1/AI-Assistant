import { getSettings, setTimezone, jsonError } from '@/lib/settings';
import { activeProvider } from '@/lib/ai';
import { readJson } from '@/lib/route-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const settings = await getSettings();
    return Response.json({ tz: settings.tz, provider: activeProvider() });
  } catch (err) { return jsonError(err); }
}

export async function PATCH(req) {
  try {
    const { tz } = await readJson(req);
    const row = await setTimezone(tz);
    return Response.json({ ok: true, tz: row.tz });
  } catch (err) { return jsonError(err); }
}
