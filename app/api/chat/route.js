import { q } from '@/lib/db';
import { jsonError } from '@/lib/settings';
import { activeProvider, chat, thinkActions } from '@/lib/ai';
import { buildContext, runActions } from '@/lib/actions';
import { localBrain } from '@/lib/localbrain';
import { readJson, bad } from '@/lib/route-helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Kept for compatibility/migration. The main chat UI now stores its conversation locally,
// so normal messages do not need Neon at all.
export async function GET() {
  try {
    const rows = await q('SELECT id, role, content, image_url, created_at FROM messages ORDER BY id DESC LIMIT 60');
    return Response.json({ messages: rows.reverse() });
  } catch (err) { return jsonError(err); }
}

// Kept for compatibility. The new Clear Chat button clears browser chat only.
export async function DELETE() {
  try {
    await q('DELETE FROM messages');
    return Response.json({ ok: true });
  } catch (err) { return jsonError(err); }
}

const TASK_OR_NOTE_OR_EVENT = /\b(add|create|make|save|write|remember|remind|task|todo|note|schedule|book|appointment|meeting|event|call|complete|done|delete|remove)\b/i;
const STORED_QUERY = /\b(my|mine|saved|stored|upcoming|open)\b.*\b(tasks?|todos?|notes?|schedule|calendar|events?|appointments?)\b|\b(tasks?|todos?|notes?|schedule|calendar|events?)\b.*\b(my|mine|saved|stored|upcoming|open)\b/i;
const IMAGE_REQUEST = /\b(draw|generate|create|make|show)\b.*\b(image|picture|photo|illustration|drawing)\b|^\s*(image|picture|photo)\b/i;

function wantsStoredData(text) { return STORED_QUERY.test(text); }
function isCommandLike(text) { return TASK_OR_NOTE_OR_EVENT.test(text) || IMAGE_REQUEST.test(text); }

export async function POST(req) {
  try {
    const body = await readJson(req);
    const userText = String(body.text || '').trim().slice(0, 4000);
    const history = Array.isArray(body.history) ? body.history.slice(-12) : [];
    const tz = typeof body.tz === 'string' && body.tz ? body.tz : 'UTC';
    if (!userText) throw bad('Say something first.');

    // Deterministic commands are handled locally first: no Gemini and no Neon reads.
    // This keeps the free Gemini quota for actual questions.
    if (isCommandLike(userText) && !wantsStoredData(userText)) {
      const local = localBrain(userText, { nowLocal: new Date().toISOString().slice(0, 16), tz, tasks: [], events: [], notes: [] });
      if (local.actions.length || /^(hi|hello|hey|yo|salam|marhaba)\b/i.test(userText)) {
        const { results, image } = await runActions(tz, local.actions);
        const reply = local.reply || results.join('\n') || 'Done.';
        return Response.json({
          message: { id: `local-${Date.now()}`, role: 'assistant', content: reply, image_url: image, created_at: new Date().toISOString() },
          actionResults: results,
          provider: 'local',
          degraded: false,
          changed: results.length > 0,
        });
      }
    }

    // Only read the personal database when the user explicitly asks about saved data
    // or when an ambiguous action needs AI help to interpret it.
    if (wantsStoredData(userText)) {
      const ctx = await buildContext(tz);
      const local = localBrain(userText, ctx);
      if (!local.actions.length && local.reply && !local.reply.includes('running without an AI key')) {
        return Response.json({
          message: { id: `local-${Date.now()}`, role: 'assistant', content: local.reply, created_at: new Date().toISOString() },
          actionResults: [], provider: 'local', degraded: false, changed: false,
        });
      }
      const out = await thinkActions(ctx, history, userText);
      const { results, image } = await runActions(tz, out.actions);
      const reply = out.reply || results.join('\n') || 'Done.';
      return Response.json({
        message: { id: `ai-${Date.now()}`, role: 'assistant', content: reply, image_url: image, created_at: new Date().toISOString() },
        actionResults: results, provider: out.provider, degraded: Boolean(out.degraded), changed: results.length > 0,
      });
    }

    // General conversation: one AI call, no Neon context/read and no JSON mode.
    const ctx = { tz, nowLocal: new Intl.DateTimeFormat('sv-SE', { timeZone: tz, dateStyle: 'short', timeStyle: 'short' }).format(new Date()).replace(' ', 'T') };
    const out = await chat(ctx, history, userText);
    return Response.json({
      message: { id: `ai-${Date.now()}`, role: 'assistant', content: out.reply, created_at: new Date().toISOString() },
      actionResults: [], provider: out.provider, degraded: Boolean(out.degraded), changed: false, error: Boolean(out.error),
    });
  } catch (err) {
    return jsonError(err);
  }
}
