export const runtime = 'nodejs';

export async function readJson(req) {
  try { return await req.json(); } catch { return {}; }
}

export function bad(message, status = 400) {
  const e = new Error(message);
  e.status = status;
  return e;
}
