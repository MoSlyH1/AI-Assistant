# Nimbus — Personal Operations Assistant

A single-user AI assistant with tasks, notes, schedule, clock, and free image generation. No sign-up, no sign-in — open it and start talking. Built with Next.js 15, Node.js, and PostgreSQL, designed to run completely free on Vercel + Neon.

## Features

- **No accounts.** No login page, no passwords, no sessions. It's yours; it opens straight in.
- **Chat interface** with an offline-first brain that gracefully falls back if your AI key is exhausted
- **Tasks** with due dates, priority levels, and completion tracking
- **Notes** with pinning and full-text search
- **Schedule** with a live 24-hour "day rail" showing today's events in real time
- **Clock** with world timezones, a timer, and a timezone setting
- **Images** via Pollinations (free, no key required)
- **Timezone-aware** everything: all times stored in UTC, displayed and input in your local zone with DST handled correctly
- **Graceful degradation**: no AI key → works offline. Provider rate-limited → falls back to offline brain. Provider down → still captures tasks.

## Tech Stack

- **Frontend**: React 19 with Next.js 15 App Router
- **Backend**: Node.js runtime, no external dependencies beyond `pg` and Next.js
- **Database**: PostgreSQL 16 (Neon free tier recommended)
- **AI**: Google Gemini (free tier via `gemini-2.0-flash`), DeepSeek as an alternative, offline brain as last resort
- **Auth**: None. This is a single-user app — whoever deploys it is the only person who can use it (there's no username or password to guard access; anyone who reaches the URL can use it, same as any personal tool without a login wall)
- **Images**: Pollinations API (free, no key, no account)
- **Styling**: Custom CSS with CSS variables, responsive to mobile

## Quick Start

### Local Development

1. **Database**: PostgreSQL 16+
   ```bash
   psql -U postgres -c "CREATE DATABASE nimbus;"
   ```

2. **Environment**
   ```bash
   cp .env.example .env.local
   # Edit .env.local:
   # - DATABASE_URL=postgresql://postgres:password@localhost/nimbus
   # - GEMINI_API_KEY=<optional: https://aistudio.google.com/apikey>
   ```

3. **Install & Migrate**
   ```bash
   npm install
   DATABASE_URL=... npm run migrate
   ```

4. **Run**
   ```bash
   npm run dev
   # Open http://localhost:3000
   ```

### Deploy to Vercel

1. **Database** (Neon):
   - Go to [neon.tech](https://neon.tech)
   - Create a free project
   - Copy the **pooled connection string** (important!)

2. **GitHub**:
   ```bash
   git init
   git add .
   git commit -m "initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USER/nimbus-assistant.git
   git push -u origin main
   ```

3. **Vercel**:
   - Import the GitHub repo at [vercel.com](https://vercel.com)
   - Add environment variables:
     - `DATABASE_URL`: paste the Neon pooled connection string
     - `GEMINI_API_KEY`: get from [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
     - `AI_PROVIDER`: `gemini` (or `deepseek` if using DeepSeek API)
   - Deploy

4. **First run**:
   - Visit your Vercel domain
   - No sign-up needed — the app opens right into the assistant
   - Set your timezone in Clock if it didn't auto-detect correctly
   - Try: `add task pay rent friday 6pm` or `image of a sunset`

**Important**: because there's no login wall, anyone with your deployment's URL can use it and see your data. Keep the URL private, or put it behind Vercel's password protection / your own reverse-proxy auth if you want an extra layer.

## How It Works

### Chat Pipeline

1. **You send a message**
2. **AI brain** (Gemini, or offline fallback) receives context:
   - Current time in your timezone
   - Open tasks and upcoming events
   - Recent notes
   - System prompt explaining what actions the model can take
3. **Model responds with JSON**:
   ```json
   {
     "reply": "what you see in chat",
     "actions": [
       { "type": "add_task", "title": "...", "due_at": "YYYY-MM-DDTHH:MM", "priority": 1|2|3 },
       { "type": "complete_task", "match": "words from the title" },
       { "type": "add_note", "title": "...", "body": "..." },
       { "type": "add_event", "title": "...", "start_at": "...", "end_at": "..." },
       { "type": "delete_task|delete_note|delete_event", "match": "..." },
       { "type": "image", "prompt": "..." }
     ]
   }
   ```
4. **Actions are executed** (database writes, image generation)
5. **Receipts are shown** in the chat bubble (e.g. "Task added: pay rent")

### Offline Brain

When no AI key is set or the provider fails, the **offline brain** still handles:
- `"add task ..."` → creates a task, parsing relative dates ("tomorrow 5pm", "friday", "in 2 hours")
- `"note: ..."` → creates a note
- `"schedule ... at ..."` → creates an event
- `"image of ..."` → generates an image via Pollinations
- `"what are my tasks"` / `"show my schedule"` → reads and displays
- `"done ..."` → marks a task complete
- General knowledge questions → responds with "add an AI key for open conversation"

The offline brain is **also the fallback** if Gemini rate-limits you or returns an error. Your data capture never breaks.

### Timezone Handling

All times are stored as UTC in the database. When you say "tomorrow 5pm", the system:
1. Reads your timezone from settings (auto-detected once, changeable in Clock)
2. Interprets "tomorrow 5pm" as local time in that timezone
3. Converts to UTC and stores it
4. When displaying, converts back to local time for the UI

DST transitions are handled correctly using `Intl.DateTimeFormat` and a convergence loop.

## API Endpoints

No authentication required — every endpoint is open. Responses are JSON.

### Settings
- `GET /api/me` — returns `{ tz, provider }`
- `PATCH /api/me` — `{ tz }` to change the timezone

### Chat
- `GET /api/chat` — recent messages
- `POST /api/chat` — `{ text }` to send a message, returns the assistant's response and action results
- `DELETE /api/chat` — clear all messages

### Tasks
- `GET /api/tasks` — list all tasks
- `POST /api/tasks` — `{ title, detail?, due_at?, priority? }`
- `PATCH /api/tasks/:id` — `{ title?, detail?, due_at?, priority?, done? }`
- `DELETE /api/tasks/:id`

### Notes
- `GET /api/notes` — list all notes; `?q=search_term` to filter
- `POST /api/notes` — `{ title?, body }`
- `PATCH /api/notes/:id` — `{ title?, body?, pinned? }`
- `DELETE /api/notes/:id`

### Events
- `GET /api/events` — list upcoming events
- `POST /api/events` — `{ title, start_at, end_at?, location? }`
- `PATCH /api/events/:id` — `{ title?, location?, start_at?, end_at? }`
- `DELETE /api/events/:id`

## Environment Variables

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `DATABASE_URL` | ✓ | — | PostgreSQL connection string. Neon free tier: copy the "pooled" variant. |
| `AI_PROVIDER` | | `gemini` | `gemini` or `deepseek`. |
| `GEMINI_API_KEY` | | (none) | From [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Free tier available. |
| `GEMINI_MODEL` | | `gemini-2.0-flash` | The Gemini model to use. |
| `GEMINI_BASE_URL` | | `https://generativelanguage.googleapis.com/v1beta` | Overridable for testing. |
| `DEEPSEEK_API_KEY` | | (none) | From [platform.deepseek.com](https://platform.deepseek.com). |
| `DEEPSEEK_MODEL` | | `deepseek-chat` | The DeepSeek model to use. |
| `DEEPSEEK_BASE_URL` | | `https://api.deepseek.com` | Overridable for testing. |

## Project Structure

```
nimbus-assistant/
├── app/                      # Next.js App Router
│   ├── api/                  # API routes
│   │   ├── chat/             # Chat endpoint (the heart)
│   │   ├── me/                # Settings (timezone) & active provider
│   │   ├── tasks/             # CRUD for tasks
│   │   ├── notes/             # CRUD for notes
│   │   └── events/            # CRUD for events
│   ├── page.js                # / (chat page)
│   ├── tasks/page.js          # /tasks
│   ├── notes/page.js          # /notes
│   ├── schedule/page.js       # /schedule with day rail
│   ├── clock/page.js          # /clock with timer
│   ├── layout.js              # Root layout
│   ├── globals.css            # All styles
│   └── not-found.js           # 404 page
├── components/                # React components
│   ├── Shell.js               # Main nav, sidebar, tab bar
│   ├── Chat.js                # Chat interface with day rail
│   ├── Tasks.js               # Task list and creation
│   ├── Notes.js               # Note grid and editor
│   ├── Schedule.js            # Event list and creation
│   ├── Clock.js               # Clock, timer, timezone setting
│   └── DayRail.js             # The 24-hour event rail
├── lib/                       # Shared logic
│   ├── db.js                  # PostgreSQL pool & query helpers
│   ├── settings.js            # Timezone settings (single row, no accounts)
│   ├── ai.js                  # Gemini & DeepSeek provider layer
│   ├── localbrain.js          # Offline brain for capture commands
│   ├── actions.js             # Execute model actions (tasks, notes, etc.)
│   ├── time.js                # Timezone & DST conversion
│   └── route-helpers.js       # API helpers (readJson, bad request)
├── db/
│   └── schema.sql             # Database schema (settings, tasks, notes, events, messages)
├── scripts/
│   └── migrate.mjs            # Run migrations
├── .env.example                # Environment template
├── .gitignore                  # Git exclusions
├── jsconfig.json               # Path aliases (@/*)
├── next.config.mjs             # Next.js config
├── package.json                # Dependencies: next, react, pg
└── package-lock.json            # Locked versions
```

## Database Schema

All times are stored in UTC as `TIMESTAMPTZ`. There is no `users` table — `settings` is a single row that holds your timezone.

```sql
CREATE TABLE settings (
  id SMALLINT PRIMARY KEY DEFAULT 1,   -- always exactly one row
  tz TEXT NOT NULL DEFAULT 'UTC'
);

CREATE TABLE tasks (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  detail TEXT DEFAULT '',
  due_at TIMESTAMPTZ,
  priority SMALLINT NOT NULL DEFAULT 2,  -- 1=urgent, 2=normal, 3=someday
  done BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE notes (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Untitled',
  body TEXT NOT NULL DEFAULT '',
  pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  location TEXT DEFAULT '',
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  role TEXT NOT NULL,  -- 'user' or 'assistant'
  content TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## Testing

The project includes a mock Gemini server pattern for local testing (see `ARCHITECTURE.md` for details). To test the Gemini code path without a real API key, point `GEMINI_BASE_URL` at a local server that mimics Gemini's response shape.

## Notes on Free Tiers

| Service | Tier | Cost | Limits |
|---------|------|------|--------|
| **Vercel** | Hobby | Free | Up to 100 serverless function invocations/day; 12 concurrent functions |
| **Neon** | Free | Free | Up to 10 projects, 3 GB storage, 20 branches |
| **Google Gemini** | Free | Free | Up to 1 RPS, 15 requests/minute, 32K tokens/day (check current limits) |
| **DeepSeek** | Free | Free | Limited, check [platform.deepseek.com](https://platform.deepseek.com) |
| **Pollinations** | Public | Free | Unlimited requests (image generation) |

## Troubleshooting

### "DATABASE_URL is not set"
Ensure you've set the environment variable before running `npm run migrate` or `npm start`.

### Tasks/notes not showing up after chat
After a chat action creates something, the UI fetches fresh data. If it's not appearing, check:
1. Browser DevTools → Network tab → check the action request status
2. The timestamp on the item (might be in the past if timezone is wrong)
3. Database directly: `psql -c "SELECT * FROM tasks;"`

### Timezone showing as UTC even after I set it
Reload the page. The timezone is read once at layout render time.

### Image generation returns a broken link
Pollinations generates images on-demand. If the URL is 404, it's likely still generating. Images sometimes take 10–30 seconds.

### Gemini quota exhausted mid-session
The app will log a provider error and fall back to the offline brain. Capture commands still work. Come back tomorrow when the quota resets.

## License

MIT. Do what you want with it.

---

**Nimbus v1.1** — no accounts, no login, just your assistant. Ready for Vercel + Neon.
