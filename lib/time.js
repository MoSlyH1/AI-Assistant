/** Timezone helpers built on Intl only — no dependencies. */

function partsIn(date, tz) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const out = {};
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return out;
}

/** Milliseconds that tz is ahead of UTC at the given instant. */
function offsetAt(date, tz) {
  const p = partsIn(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
  return asUtc - date.getTime();
}

/**
 * Turn a local wall-clock string ("2026-08-25T17:30") into a real UTC Date,
 * interpreting it in the given timezone. Handles DST by converging twice.
 */
export function localToUtc(local, tz = 'UTC') {
  if (!local) return null;
  const m = String(local).trim().match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) {
    const d = new Date(local);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const [, Y, Mo, D, H, Mi] = m.map(Number);
  let guess = Date.UTC(Y, Mo - 1, D, H, Mi);
  for (let i = 0; i < 2; i++) {
    guess = Date.UTC(Y, Mo - 1, D, H, Mi) - offsetAt(new Date(guess), tz);
  }
  const d = new Date(guess);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "2026-08-25T17:30" for an instant, as seen in tz. */
export function utcToLocalString(date, tz = 'UTC') {
  if (!date) return null;
  const p = partsIn(new Date(date), tz);
  const pad = (n) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour % 24)}:${pad(p.minute)}`;
}

/** Human label, e.g. "Tue 25 Aug, 17:30". */
export function prettyTime(date, tz = 'UTC') {
  if (!date) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(date));
}

export function startOfLocalDay(date, tz, dayOffset = 0) {
  const p = partsIn(new Date(date), tz);
  const pad = (n) => String(n).padStart(2, '0');
  const base = localToUtc(`${p.year}-${pad(p.month)}-${pad(p.day)}T00:00`, tz);
  return new Date(base.getTime() + dayOffset * 86400000);
}

export function isValidTz(tz) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; }
  catch { return false; }
}
