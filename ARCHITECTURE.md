# Nimbus Architecture

## Overview

Nimbus is a full-stack Next.js 15 app that acts as a personal assistant. The core innovation is **graceful degradation**: it works offline, degrades under load, and never breaks your data capture.

```
┌──────────────────────────────────────────────────────────────┐
│                          BROWSER                             │
│  React 19 Components (Chat, Tasks, Notes, Schedule, Clock)  │
└────────────────────┬─────────────────────────────────────────┘
                     │ HTTP/JSON (fetch)
┌────────────────────▼─────────────────────────────────────────┐
│                    NEXT.JS 15 (Node.js)                       │
│                                                               │
│  Pages:               API Routes:              Lib:          │
│  /                    /tasks                db.js             │
│  /tasks               /notes                ai.js             │
│  /notes               /events               actions.js        │
│  /schedule            /chat                 time.js           │
│  /clock               /me                   localbrain.js    │
│                                                                │
│  (no login page — single-user, opens straight in)             │
│                                                               │
└────────────────────┬─────────────────────────────────────────┘
                     │
        ┌────────────┴─────────────┐
        │                          │
        ▼                          ▼
┌───────────────────┐      ┌──────────────────┐
│  PostgreSQL 16    │      │  Gemini / DeepSeek
│  (Neon Pooler)    │      │  (Free APIs)
│                   │      │
│ - users           │      │ Intent: chat
│ - tasks           │      │ Context: tasks+events+notes
│ - notes           │      │ Action: create tasks/events/notes
│ - events          │      │ Fallback: offline brain
│ - messages        │      │ Image: Pollinations (free)
└───────────────────┘      └──────────────────┘
```

## The Chat Pipeline

This is where Nimbus is most interesting. Every message goes through this:

```
User message
    │
    ▼
Load context (tasks, events, notes, timezone, now)
    │
    ▼
Try AI provider (Gemini → DeepSeek → offline brain)
    │
    ├─ Provider says yes
    │   │
    │   ▼
    │ Parse JSON response (with trailing-comma recovery)
    │   │
    │   ▼
    │ Execute actions (database writes, image generation)
    │   │
    │   ▼
    │ Store assistant message + image URL + receipts
    │   │
    │   ▼
    │ Send to client: [message, actionResults, provider, degraded]
    │
    └─ Provider returns 429 / fails / times out
        │
        ▼
    Silently retry with offline brain
        │
        ▼
    Send to client: [message, actionResults, provider="offline", degraded=true]
```

### Why This Matters

- **No AI key?** Offline brain handles all capture commands (add task, note, event). Open conversation gets a hint to add a key.
- **Rate limited?** App falls back to offline brain mid-sentence. User still sees their task created.
- **Provider dies?** Still captures. UX stays smooth.
- **Bad JSON from model?** Recovery logic strips fences, removes trailing commas, re-parses.
- **Bad action in a batch?** Skips that one, executes the rest.

## Settings (No Accounts)

Nimbus has no `users` table and no login flow. There is exactly one `settings` row
(`id = 1`) holding your timezone. `lib/settings.js` reads it, seeding it with `UTC`
on first use if it doesn't exist yet:

```js
export async function getSettings() {
  const row = await one('SELECT tz FROM settings WHERE id = 1');
  if (row) return row;
  await q("INSERT INTO settings (id, tz) VALUES (1, 'UTC') ON CONFLICT (id) DO NOTHING");
  return { tz: 'UTC' };
}
```

Every API route reads this once per request and uses it for date math — no session,
no cookie, no per-request auth check. Because there's no login wall, anyone with the
app's URL can read and write its data. That's an acceptable model for a personal,
single-operator deployment kept behind a private URL (or Vercel's Deployment
Protection); it is not meant for a public or multi-tenant deployment.

## Timezone Handling

The trickiest part. All times are stored as UTC in the database. The user never sees UTC.

### Local to UTC Conversion

When the user says "tomorrow 5pm" in the chat or types into a datetime-local input:

1. Get user's timezone from their profile
2. Interpret as wall-clock time in that timezone
3. Parse "tomorrow" relative to the current time in that timezone
4. Convert to UTC using the formula:
   ```
   UTC_time = local_wall_clock_time - offset_for_that_timezone_at_that_instant
   ```
5. But wait — the offset depends on the UTC time (DST is time-dependent). So:
   ```
   guess = UTC for local wall clock
   for i in 0 to 1:
     guess = UTC - offset_at(guess, tz)  # refine the guess
   ```
   This converges in 2 iterations for any DST transition.

### UTC to Local Conversion (Display)

When showing a task due "2026-08-27T15:00:00Z":

1. Get user's timezone
2. Use Intl.DateTimeFormat with `timeZone: tz`
3. Returns the local wall-clock time as the user sees it

Example: UTC 15:00 in Asia/Beirut (UTC+3) is 18:00 local. UTC 15:00 in America/New_York (UTC-4 or -5 depending on DST) is 10:00 or 11:00 local.

The logic is in `lib/time.js`.

## The Offline Brain

When Gemini is unavailable, the offline brain kicks in. It's a regex-based NLU:

```
"add task X by Y" → type: add_task, title: X, due_at: Y
"note: X" → type: add_note, title: X, body: X
"schedule X tomorrow 3pm" → type: add_event, title: X, start_at: tomorrow 3pm
"image of X" → type: image, prompt: X
"done X" → type: complete_task, match: X
"what are my tasks" → read_out tasks
"show my schedule" → read_out events
Anything else → ask for an AI key
```

The offline brain understands relative dates:
- "tomorrow", "today", "tonight" → day offset
- "Friday", "Monday" → day of week
- "5pm", "14:30", "9 am" → time of day
- "in 2 hours" → (not yet implemented, but could be)

It's not a real NLU, but it's **enough** for the 80% of interactions that are data capture.

## Database Schema

All times stored as `TIMESTAMPTZ` (UTC). No timezone column in tasks/events — the user's timezone is stored once in `users.tz`.

```
settings
  id SMALLINT PK, always 1 (singleton row)
  tz TEXT ("Asia/Beirut", "UTC", etc.)

tasks
  id SERIAL PK
  title TEXT (not null)
  detail TEXT (optional)
  due_at TIMESTAMPTZ (nullable)
  priority INT (1=urgent, 2=normal, 3=someday)
  done BOOLEAN
  created_at TIMESTAMPTZ
  completed_at TIMESTAMPTZ (set when done=true)
  index: (done, due_at)  ← fast queries for "show me open tasks due soon"

notes
  id SERIAL PK
  title TEXT
  body TEXT
  pinned BOOLEAN
  created_at TIMESTAMPTZ
  updated_at TIMESTAMPTZ
  index: (pinned DESC, updated_at DESC)  ← fast sort by recency

events
  id SERIAL PK
  title TEXT
  location TEXT
  start_at TIMESTAMPTZ
  end_at TIMESTAMPTZ
  created_at TIMESTAMPTZ
  index: (start_at)  ← fast "upcoming events" query

messages
  id SERIAL PK
  role TEXT ("user" or "assistant")
  content TEXT (the message or reply)
  image_url TEXT (nullable, filled by image actions)
  created_at TIMESTAMPTZ
  index: (id DESC)  ← load last 60 messages
```

## API Design

All endpoints return JSON. All mutations require authentication.

### Errors

```json
{ "error": "Human-readable message" }
```

HTTP status codes:
- 200: OK
- 201: Created
- 400: Bad request (invalid input)
- 404: Not found (resource doesn't exist)
- 500: Server error

### Pagination

Currently, no pagination. Queries limit to:
- Tasks: 40
- Events: 25
- Notes: 15 (can search to narrow)
- Messages: 60 (most recent)

If a user has 100 tasks, they see all 100 open + all 100 done (sorted). This scales to a few thousand before needing cursor-based pagination.

## Frontend Components

### Shell.js

Top-level nav. Renders sidebar (desktop) or tab bar (mobile). No sign-out — there is nothing to sign out of.

### Chat.js

The heart. Renders:
- DayRail (live 24-hour event view)
- Message bubbles (me = amber, bot = panel)
- Image previews
- Action receipts (green chips for success, red for errors)
- Composer textarea + send button
- Starter prompts if empty

### Tasks.js

Task list filtered by open/done. Inline creation. Click the checkbox to toggle. Priority colors (red=urgent, amber=normal, gray=someday). Delete buttons.

### Notes.js

Grid of notes. Click to edit (opens a modal-like form). Pinning. Search (live debounce, 250ms).

### Schedule.js

Event list grouped by day. Inline creation (title, start, end, location). Delete buttons. DayRail at the top.

### Clock.js

Analog clock (but text-based for simplicity). Timer with presets (5, 10, 25, 45 min). Timezone picker (selector + sync to profile). Shows other zones.

### DayRail.js

The signature visual. 24-hour track from 00 to 24. Events pinned along it. Live amber marker for now. Syncs every 30 seconds.

## Deployment Notes

### Vercel

- Next.js is built and deployed as a serverless function per route
- Each request spins up a new function (cold start ~ 300ms)
- Database pool handles many concurrent requests from many functions
- Env vars are baked into the build, not runtime
- Free tier: 100 invocations/day, 12 concurrent functions
- If you hit limits, upgrade to Pro ($20/mo)

### Neon

- PostgreSQL 16 managed by Neon
- Free tier: 3 GB storage, 10 projects, 3 branches
- Pooler endpoint (required for serverless) is always-on
- Auto-suspends idle projects after 1 week (but free tier projects don't suspend)
- No manual backups on free tier, but Neon handles durability

### Gemini

- Free tier: 15 req/min, 32K tokens/day
- Quota resets at midnight Pacific time
- Rate limit: 429 response (app handles with offline fallback)
- Token limit: mid-conversation cap (app handles by truncating history)

## What's Not Included

- Push notifications
- Sync to other services (Google Tasks, Google Calendar)
- Voice input
- Offline-first (no service worker, no cache-first strategy)
- Real-time collaboration (no WebSockets)
- File uploads
- Recurring tasks
- Task dependencies
- Subtasks
- Reminders (other than the due date display)

These could all be added, but they're out of scope for the 1.0 release.

---

**That's the architecture. Questions? Read the code — it's commented and straightforward.**
