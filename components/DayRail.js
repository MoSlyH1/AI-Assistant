'use client';

import { useEffect, useState } from 'react';

/** Minutes since local midnight for an instant, in the given timezone. */
function minutesInDay(date, tz) {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit',
  }).formatToParts(date).reduce((a, x) => (x.type !== 'literal' ? { ...a, [x.type]: Number(x.value) } : a), {});
  return (p.hour % 24) * 60 + p.minute;
}

function sameLocalDay(a, b, tz) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  return f.format(a) === f.format(b);
}

/**
 * The day rail: today compressed into one 24-hour track, with a live
 * marker for now and a block for every event.
 */
export default function DayRail({ events = [], tz = 'UTC' }) {
  const [now, setNow] = useState(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!now) return <div className="rail-wrap" style={{ height: 118 }} aria-hidden />;

  const today = events
    .map((e) => ({ ...e, s: new Date(e.start_at), e2: new Date(e.end_at) }))
    .filter((e) => sameLocalDay(e.s, now, tz))
    .sort((a, b) => a.s - b.s);

  const nowMin = minutesInDay(now, tz);
  const clock = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(now);
  const dayLabel = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, weekday: 'long', day: 'numeric', month: 'long',
  }).format(now);

  return (
    <div className="rail-wrap">
      <div className="rail-head">
        <span className="rail-title">{dayLabel}</span>
        <span className="rail-now">{clock}</span>
      </div>
      <div className="rail">
        {[3, 6, 9, 12, 15, 18, 21].map((h) => (
          <div key={h} className="rail-hour" style={{ left: `${(h / 24) * 100}%` }} />
        ))}
        {today.map((e) => {
          const start = minutesInDay(e.s, tz);
          const end = sameLocalDay(e.e2, now, tz) ? minutesInDay(e.e2, tz) : 1440;
          const width = Math.max(end - start, 20);
          return (
            <div
              key={e.id}
              className="rail-block"
              style={{ left: `${(start / 1440) * 100}%`, width: `${(width / 1440) * 100}%` }}
              title={e.title}
            >
              {e.title}
            </div>
          );
        })}
        {!today.length && <div className="rail-empty">No events today</div>}
        <div className="rail-mark" style={{ left: `${(nowMin / 1440) * 100}%` }} />
      </div>
      <div className="rail-scale">
        <span>00</span><span>06</span><span>12</span><span>18</span><span>24</span>
      </div>
    </div>
  );
}
