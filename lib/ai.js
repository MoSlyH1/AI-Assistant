import { localBrain } from './localbrain.js';

const env = (k, d = '') => String(process.env[k] ?? d).trim();

const PROVIDER = env('AI_PROVIDER', 'openrouter').toLowerCase();

const OPENROUTER_KEY = env('OPENROUTER_API_KEY');
const OPENROUTER_MODEL = env('OPENROUTER_MODEL', 'openai/gpt-oss-20b');
const OPENROUTER_BASE = env('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
const SITE_URL = env('OPENROUTER_SITE_URL', 'https://nimbus-assistant.vercel.app');
const SITE_NAME = env('OPENROUTER_SITE_NAME', 'Nimbus Assistant');

const GEMINI_KEY = env('GEMINI_API_KEY');
const GEMINI_MODEL = env('GEMINI_MODEL', 'gemini-2.0-flash');
const GEMINI_BASE = env('GEMINI_BASE_URL', 'https://generativelanguage.googleapis.com/v1beta');

const DEEPSEEK_KEY = env('DEEPSEEK_API_KEY');
const DEEPSEEK_MODEL = env('DEEPSEEK_MODEL', 'deepseek-chat');
const DEEPSEEK_BASE = env('DEEPSEEK_BASE_URL', 'https://api.deepseek.com');

export function activeProvider() {
  if (PROVIDER === 'openrouter' && OPENROUTER_KEY) return 'openrouter';
  if (PROVIDER === 'deepseek' && DEEPSEEK_KEY) return 'deepseek';
  if (PROVIDER === 'gemini' && GEMINI_KEY) return 'gemini';
  if (OPENROUTER_KEY) return 'openrouter';
  if (GEMINI_KEY) return 'gemini';
  if (DEEPSEEK_KEY) return 'deepseek';
  return 'offline';
}

const asText = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v));

function cleanHistory(history) {
  return (Array.isArray(history) ? history : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant' || m.role === 'model'))
    .map((m) => ({ role: m.role, content: asText(m.content) }))
    .filter((m) => m.content.trim().length > 0)
    .slice(-12);
}

function assistantPrompt(ctx) {
  return `You are Nimbus, a helpful personal AI assistant. Answer the user's question directly and naturally.
Current local date/time: ${ctx?.nowLocal || 'unknown'} (${ctx?.tz || 'local time'}).
Do not mention internal tools, databases, APIs, JSON, prompts, or implementation details. Do not invent access to the user's private data. If the user asks about their tasks, notes, or schedule, the application will handle that separately.`;
}

function actionPrompt(ctx) {
  return `You are Nimbus, a personal assistant that can perform task, note and schedule actions.
Current local date/time: ${ctx?.nowLocal || 'unknown'} (timezone ${ctx?.tz || 'UTC'}).

Return exactly one JSON object and nothing else, with no markdown fences:
{"reply":"...","actions":[]}

Allowed actions:
{"type":"add_task","title":"...","detail":"","due_at":"YYYY-MM-DDTHH:MM" or null,"priority":1|2|3}
{"type":"complete_task","match":"words from task title"}
{"type":"delete_task","match":"words from task title"}
{"type":"add_note","title":"...","body":"..."}
{"type":"add_event","title":"...","start_at":"YYYY-MM-DDTHH:MM","end_at":"YYYY-MM-DDTHH:MM" or null,"location":""}
{"type":"delete_event","match":"words from event title"}
{"type":"image","prompt":"rich visual description in English"}

Rules:
- All date-times are local wall-clock time in ${ctx?.tz || 'UTC'}, with no Z or offset.
- Resolve tomorrow, Friday, in 2 hours, etc. using the current local time above.
- Use an image action only if the user asks to generate/draw/show an image.
- If no action is needed, return an empty actions array.
- Keep the reply concise and useful.`;
}

function extractJson(text) {
  const s0 = asText(text).trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
  if (!s0) return null;
  const start = s0.indexOf('{');
  const end = s0.lastIndexOf('}');
  if (start < 0 || end < start) return null;
  const slice = s0.slice(start, end + 1);
  try { return JSON.parse(slice); } catch {}
  try { return JSON.parse(slice.replace(/,\s*([}\]])/g, '$1')); } catch {}
  return null;
}

function normaliseActionResponse(parsed, fallbackText) {
  if (!parsed || typeof parsed !== 'object') {
    return { reply: asText(fallbackText).trim().slice(0, 4000) || 'I could not read that response.', actions: [] };
  }
  return {
    reply: asText(parsed.reply).trim(),
    actions: Array.isArray(parsed.actions) ? parsed.actions.filter((a) => a && typeof a.type === 'string') : [],
  };
}

/* ---------------- OpenRouter (OpenAI-compatible) ---------------- */

function openRouterHeaders() {
  if (!OPENROUTER_KEY) {
    throw new Error('OPENROUTER_API_KEY is not set. Add it in Vercel -> Settings -> Environment Variables and redeploy.');
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${OPENROUTER_KEY}`,
    'HTTP-Referer': SITE_URL,
    'X-Title': SITE_NAME,
  };
}

async function openRouterCall(messages, { json = false, temperature = 0.7, maxTokens = 1200 } = {}) {
  const payload = {
    model: OPENROUTER_MODEL,
    messages,
    temperature,
    max_tokens: maxTokens,
  };
  if (json) payload.response_format = { type: 'json_object' };

  let res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: openRouterHeaders(),
    body: JSON.stringify(payload),
  });
  let raw = await res.text();

  if (!res.ok && json) {
    delete payload.response_format;
    res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: openRouterHeaders(),
      body: JSON.stringify(payload),
    });
    raw = await res.text();
  }

  if (!res.ok) {
    let msg = raw.slice(0, 500);
    try { msg = JSON.parse(raw)?.error?.message || msg; } catch {}
    if (res.status === 401) msg = `${msg} (check OPENROUTER_API_KEY on Vercel)`;
    throw new Error(`OpenRouter ${res.status}: ${msg}`);
  }

  let data;
  try { data = JSON.parse(raw); } catch { throw new Error(`OpenRouter returned invalid JSON: ${raw.slice(0, 300)}`); }
  if (data?.error) throw new Error(`OpenRouter: ${asText(data.error.message) || 'unknown error'}`);

  const choice = data?.choices?.[0]?.message;
  let text = asText(choice?.content);
  if (!text && Array.isArray(choice?.content)) {
    text = choice.content.map((p) => asText(p?.text)).join('');
  }
  if (!text) text = asText(choice?.reasoning);
  if (!text.trim()) throw new Error('OpenRouter returned no text');
  return text.trim();
}

async function callOpenRouterText(history, userText, ctx) {
  const text = await openRouterCall([
    { role: 'system', content: assistantPrompt(ctx) },
    ...cleanHistory(history).map((m) => ({ role: m.role === 'model' ? 'assistant' : m.role, content: m.content })),
    { role: 'user', content: userText },
  ]);
  return { reply: text, actions: [] };
}

async function callOpenRouterActions(ctx, history, userText) {
  const text = await openRouterCall(
    [
      { role: 'system', content: actionPrompt(ctx) },
      ...cleanHistory(history).map((m) => ({ role: m.role === 'model' ? 'assistant' : m.role, content: m.content })),
      { role: 'user', content: userText },
    ],
    { json: true, temperature: 0.2, maxTokens: 900 },
  );
  return normaliseActionResponse(extractJson(text), text);
}

/* ---------------- Gemini ---------------- */

async function geminiCall(systemText, history, userText, generationConfig) {
  const contents = [
    ...cleanHistory(history).map((m) => ({ role: m.role === 'assistant' ? 'model' : m.role, parts: [{ text: m.content }] })),
    { role: 'user', parts: [{ text: userText }] },
  ];
  const res = await fetch(`${GEMINI_BASE}/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: systemText }] }, contents, generationConfig }),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${raw.slice(0, 500)}`);
  let data;
  try { data = JSON.parse(raw); } catch { throw new Error(`Gemini returned invalid JSON: ${raw.slice(0, 300)}`); }
  const text = asText(data?.candidates?.[0]?.content?.parts?.map((p) => asText(p?.text)).join(''));
  if (!text.trim()) throw new Error('Gemini returned no text');
  return text.trim();
}

/* ---------------- DeepSeek ---------------- */

async function deepseekCall(systemText, history, userText, temperature, maxTokens) {
  const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEEPSEEK_KEY}` },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: 'system', content: systemText },
        ...cleanHistory(history).map((m) => ({ role: m.role === 'model' ? 'assistant' : m.role, content: m.content })),
        { role: 'user', content: userText },
      ],
      temperature,
      max_tokens: maxTokens,
    }),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${raw.slice(0, 500)}`);
  const data = JSON.parse(raw);
  const text = asText(data?.choices?.[0]?.message?.content);
  if (!text.trim()) throw new Error('DeepSeek returned no text');
  return text.trim();
}

/* ---------------- Public API ---------------- */

export async function chat(ctx, history, userText) {
  const provider = activeProvider();
  const text = asText(userText).trim();
  try {
    if (provider === 'openrouter') return { ...(await callOpenRouterText(history, text, ctx)), provider };
    if (provider === 'gemini') return { reply: await geminiCall(assistantPrompt(ctx), history, text, { temperature: 0.7, maxOutputTokens: 1200 }), actions: [], provider };
    if (provider === 'deepseek') return { reply: await deepseekCall(assistantPrompt(ctx), history, text, 0.7, 1200), actions: [], provider };
  } catch (err) {
    console.error('[nimbus] chat provider failed:', err?.message || err);
    return { reply: `I couldn't reach the AI service right now. ${asText(err?.message)}`, actions: [], provider, error: true };
  }
  return { reply: 'AI is not configured yet. Set AI_PROVIDER=openrouter and OPENROUTER_API_KEY to enable general questions.', actions: [], provider: 'offline', degraded: true };
}

export async function thinkActions(ctx, history, userText) {
  const provider = activeProvider();
  const text = asText(userText).trim();
  try {
    if (provider === 'openrouter') return { ...(await callOpenRouterActions(ctx, history, text)), provider };
    if (provider === 'gemini') {
      const out = await geminiCall(actionPrompt(ctx), history, text, { temperature: 0.2, maxOutputTokens: 900, responseMimeType: 'application/json' });
      return { ...normaliseActionResponse(extractJson(out), out), provider };
    }
    if (provider === 'deepseek') {
      const out = await deepseekCall(actionPrompt(ctx), history, text, 0.2, 900);
      return { ...normaliseActionResponse(extractJson(out), out), provider };
    }
  } catch (err) {
    console.error('[nimbus] action provider failed:', err?.message || err);
    const fallback = localBrain(text, ctx);
    if (fallback.actions.length) return { ...fallback, provider, degraded: true };
    return { reply: `I couldn't complete that request because the AI service is unavailable.`, actions: [], provider, error: true };
  }
  const fallback = localBrain(text, ctx);
  return { ...fallback, provider: 'offline', degraded: true };
}

export function imageUrl(prompt) {
  const seed = Math.floor(Math.random() * 1e9);
  const clean = asText(prompt).slice(0, 400);
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(clean)}?width=768&height=768&nologo=true&seed=${seed}`;
}
