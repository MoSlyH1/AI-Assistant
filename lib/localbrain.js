/**
 * Offline fallback brain. Runs when no AI key is configured, or when the
 * provider call fails. It cannot answer open questions, but every
 * capture command (tasks, notes, events, images) still works.
 */

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function pad(n) { return String(n).padStart(2, '0'); }

/** Parse "tomorrow 5pm", "today 14:30", "monday 9am" against local now. */
function parseWhen(text, nowLocal) {
  text = String(text ?? '');
  const safeNow = typeof nowLocal === 'string' && nowLocal.includes('T')
    ? nowLocal
    : new Date().toISOString().slice(0, 16);
  const [datePart, timePart] = safeNow.split('T');
  let [Y, M, D] = datePart.split('-').map(Number);
  let hour = null, min = 0, dayShift = null;

  const t = text.toLowerCase();
  const time = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/) || t.match(/\b(\d{1,2}):(\d{2})\b/);
  if (time) {
    hour = Number(time[1]);
    min = Number(time[2] || 0);
    const mer = time[3];
    if (mer === 'pm' && hour < 12) hour += 12;
    if (mer === 'am' && hour === 12) hour = 0;
  }

  if (/\btomorrow\b/.test(t)) dayShift = 1;
  else if (/\btoday\b|\btonight\b/.test(t)) dayShift = 0;
  else {
    const wd = DAYS.findIndex((d) => new RegExp(`\\b${d}\\b`).test(t));
    if (wd >= 0) {
      const todayIdx = new Date(`${datePart}T12:00:00Z`).getUTCDay();
      dayShift = (wd - todayIdx + 7) % 7 || 7;
    }
  }
  if (hour === null && dayShift === null) return null;
  if (hour === null) { hour = 9; min = 0; }
  if (dayShift === null) {
    const nowH = Number(timePart.slice(0, 2));
    const nowM = Number(timePart.slice(3, 5));
    dayShift = hour * 60 + min < nowH * 60 + nowM ? 1 : 0;
  }
  const d = new Date(Date.UTC(Y, M - 1, D + dayShift));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(hour)}:${pad(min)}`;
}

function stripWhen(s) {
  return String(s ?? '')
    .replace(/\b(at|on|by)?\s*\b(\d{1,2})(:\d{2})?\s*(am|pm)\b/gi, '')
    .replace(/\b(today|tomorrow|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s,–-]+$/, '')
    .trim();
}

export function localBrain(text, ctx) {
  const raw = String(text ?? '').trim();
  const t = raw.toLowerCase();
  const safeCtx = ctx && typeof ctx === 'object' ? ctx : {};
  const nowLocal = typeof safeCtx.nowLocal === 'string' && safeCtx.nowLocal.includes('T')
    ? safeCtx.nowLocal
    : new Date().toISOString().slice(0, 16);
  ctx = { tasks: [], events: [], notes: [], tz: 'UTC', ...safeCtx, nowLocal };

  // Image
  let m = raw.match(/^(?:draw|generate|create|make|show)?\s*(?:me\s*)?(?:an?\s*)?(?:image|picture|photo|drawing|illustration)\s*(?:of|about|showing)?\s*(.+)$/i);
  if (m && m[1]) {
    return { reply: `Here is an image of ${m[1].trim()}.`, actions: [{ type: 'image', prompt: m[1].trim() }] };
  }

  // Note
  m = raw.match(/^(?:note|write a note|save a note|remember)\s*(?:that|about|:)?\s*(.+)$/i);
  if (m) {
    const body = m[1].trim();
    const title = body.split(/[.\n]/)[0].slice(0, 60);
    return { reply: `Saved a note: "${title}".`, actions: [{ type: 'add_note', title, body }] };
  }

  // Event
  m = raw.match(/^(?:schedule|book|set up|add)\s+(?:a\s+|an\s+)?(meeting|event|appointment|call)\s*(.*)$/i);
  if (m) {
    const when = parseWhen(raw, nowLocal);
    const rest = stripWhen(m[2]);
    const kind = m[1].toLowerCase();
    let title = rest ? `${kind} ${rest}` : kind;
    title = title.charAt(0).toUpperCase() + title.slice(1);
    if (when) return { reply: `Added "${title}" to your schedule.`, actions: [{ type: 'add_event', title, start_at: when }] };
    return { reply: `I need a time for "${title}". Try: schedule ${title} tomorrow 3pm.`, actions: [] };
  }

  // Task
  m = raw.match(/^(?:add(?:\sa)?\s*task|task|todo|to-do|remind me to|i need to|don't let me forget to)\s*[:\-]?\s*(.+)$/i);
  if (m) {
    const when = parseWhen(raw, nowLocal);
    const title = stripWhen(m[1]) || m[1].trim();
    return {
      reply: when ? `Task added: "${title}", due ${when.replace('T', ' ')}.` : `Task added: "${title}".`,
      actions: [{ type: 'add_task', title, due_at: when || null }],
    };
  }

  // Complete
  m = raw.match(/^(?:done|complete[d]?|finished|mark(?:\sas)?\sdone|check off)\s*[:\-]?\s*(.+)$/i);
  if (m) return { reply: `Marked "${m[1].trim()}" as done.`, actions: [{ type: 'complete_task', match: m[1].trim() }] };

  // Read-outs
  if (/^(what|show|list|give me).*(task|todo|to-do)/i.test(t)) {
    const open = ctx.tasks.filter((x) => !x.done);
    return {
      reply: open.length
        ? `You have ${open.length} open task${open.length > 1 ? 's' : ''}:\n` + open.map((x) => `• ${x.title}${x.due_local ? ` — ${x.due_local.replace('T', ' ')}` : ''}`).join('\n')
        : 'Nothing open. Your task list is clear.',
      actions: [],
    };
  }
  if (/^(what|show|list).*(schedule|calendar|day|agenda|event)/i.test(t)) {
    return {
      reply: ctx.events.length
        ? 'Coming up:\n' + ctx.events.map((e) => `• ${e.title} — ${e.start_local.replace('T', ' ')}`).join('\n')
        : 'Nothing scheduled yet.',
      actions: [],
    };
  }
  if (/^(what.*time|time is it)/i.test(t)) {
    return { reply: `It is ${nowLocal.split('T')[1]} on ${nowLocal.split('T')[0]} (${ctx.tz}).`, actions: [] };
  }
  if (/^(hi|hello|hey|yo|salam|marhaba)\b/i.test(t)) {
    return { reply: 'Hey. Tell me what to capture — a task, a note, or something to schedule.', actions: [] };
  }

  return {
    reply:
      'I am running without an AI key, so I can only handle capture commands right now.\n\n' +
      'Try: "add task pay rent friday 6pm", "note: deploy steps for Neon", "schedule meeting with Rony tomorrow 3pm", "image of a cedar tree at sunset", or "what are my tasks".\n\n' +
      'Set AI_PROVIDER=openrouter and OPENROUTER_API_KEY in your environment for open conversation.',
    actions: [],
  };
}
