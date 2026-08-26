# START HERE

Welcome to **Nimbus**, your personal operations assistant.

## What Is This?

A complete, tested, ready-to-deploy web app that:
- Lets you chat with an AI assistant (offline-first, graceful fallback)
- Tracks tasks, notes, events, and time
- Works completely free on Vercel + Neon
- Stores everything in your own PostgreSQL database
- **Has no sign-up or sign-in page** — it opens straight into the assistant

## The Four Documents

1. **[QUICKSTART.md](./QUICKSTART.md)** — Read this first (5 min). Deploy in 10 minutes.
2. **[README.md](./README.md)** — Full feature docs, API reference, troubleshooting.
3. **[DEPLOYMENT.md](./DEPLOYMENT.md)** — Step-by-step deployment to production, including how to keep it private.
4. **[ARCHITECTURE.md](./ARCHITECTURE.md)** — How it works under the hood.

## Fastest Path to a Running App

### Step 1: Get Accounts (2 min)
- GitHub (create a repo — make it **private**)
- Vercel (sign in with GitHub)
- Neon (create a PostgreSQL project)
- (Optional) Google API (for Gemini key)

### Step 2: Create Database (1 min)
- Go to [neon.tech](https://neon.tech)
- New Project
- Copy the **pooled** connection string

### Step 3: Get API Key (1 min)
- Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
- Create API Key
- Copy it (optional, but recommended)

### Step 4: Deploy (3 min)
- Push this repo to GitHub
- Import it in Vercel
- Add env vars:
  - `DATABASE_URL` = Neon connection string
  - `GEMINI_API_KEY` = your key from step 3
- Click Deploy

### Step 5: Run Migration (1 min)
```bash
npm install
DATABASE_URL="<your-connection-string>" npm run migrate
```

### Step 6: Use It
- Open your Vercel URL — no sign-up, it just opens
- Type: `add task buy groceries tomorrow 6pm`

**Total time: 15 minutes. Cost: $0.**

## A Note on Privacy

Because there's no login page, anyone with your app's URL can use it and see your data. That's fine for a private personal tool — keep the URL to yourself, or turn on Vercel's built-in **Deployment Protection** (a password prompt in front of the whole site) in your project settings. Details in DEPLOYMENT.md.

## File Structure

```
nimbus-assistant/
├── START_HERE.md              ← You are here
├── QUICKSTART.md              ← Read next
├── README.md                  ← Full docs
├── DEPLOYMENT.md              ← Deployment steps
├── ARCHITECTURE.md            ← How it works
├── .env.example                ← Copy to .env.local, fill in values
├── package.json                ← Dependencies: next, react, pg
├── app/                        ← Next.js pages & API routes
│   ├── api/                    ← REST API
│   │   ├── chat/               ← Chat endpoint (the brain)
│   │   ├── me/                  ← Timezone setting & active provider
│   │   ├── tasks/                ← CRUD for tasks
│   │   ├── notes/                ← CRUD for notes
│   │   └── events/               ← CRUD for events
│   ├── page.js                  ← Chat page (main, opens by default)
│   ├── tasks/page.js             ← Task list
│   ├── notes/page.js             ← Note grid
│   ├── schedule/page.js          ← Calendar
│   ├── clock/page.js             ← Clock & timer
│   └── globals.css               ← All styling
├── components/                  ← React components
│   ├── Chat.js                   ← Chat UI
│   ├── DayRail.js                ← 24-hour event view (signature)
│   ├── Tasks.js                  ← Task UI
│   ├── Notes.js                  ← Note UI
│   ├── Schedule.js               ← Event UI
│   ├── Clock.js                  ← Clock UI
│   └── Shell.js                  ← Main nav
├── lib/                          ← Core logic
│   ├── ai.js                     ← Gemini & DeepSeek provider
│   ├── localbrain.js             ← Offline AI (regex-based NLU)
│   ├── actions.js                ← Execute actions (create tasks/events/etc)
│   ├── settings.js               ← Timezone setting (single row, no accounts)
│   ├── db.js                     ← PostgreSQL pool & queries
│   ├── time.js                   ← Timezone handling (DST-aware)
│   └── route-helpers.js          ← API helpers
├── db/
│   └── schema.sql                ← Database schema
└── scripts/
    └── migrate.mjs                ← Run migrations
```

## Key Features

### Chat Interface
- Talk naturally: "add task X by Friday 5pm"
- AI understands and creates tasks/notes/events
- Works offline if no API key (graceful fallback)
- Falls back to offline brain if AI rate-limited
- Generates images via Pollinations (free, no key)

### Tasks
- Due dates and priorities (urgent/normal/someday)
- Mark done/not done with checkbox
- Inline editing
- Sorted by priority and due date

### Notes
- Create, edit, pin, search
- Full-text search
- Pin important notes to the top

### Schedule
- Live 24-hour "day rail" showing today's events
- Add events with timezone awareness
- All times shown in your local timezone

### Clock
- Current time + world zones
- Timer with presets (5, 10, 25, 45 min)
- Timezone selector (auto-detects)

### No Accounts
- Opens straight into the assistant, every time
- One timezone setting, stored server-side
- Nothing to sign up for, nothing to remember

## What Makes This Different

1. **Offline-first brain**: Works without an AI key. Falls back gracefully if rate-limited.
2. **Single source of truth**: All data in your Neon database. No Google sync, no cloud lock-in.
3. **Timezone-aware**: All times stored in UTC, displayed in your local timezone. DST-correct.
4. **Zero dependencies**: Only `pg` and `next`.
5. **No login wall**: It's your app, on your URL. No accounts to manage.

## Test Results

All of the following were tested and verified:

- ✓ CRUD operations (create/read/update/delete tasks, notes, events) — no auth needed
- ✓ Timezone math (DST correct across winter/summer for multiple zones)
- ✓ Chat → action → database (all 7 action types tested)
- ✓ Graceful degradation (rate limits, malformed JSON, provider outage all handled)
- ✓ Offline brain (all capture commands work without AI)
- ✓ Production build (clean compile, optimized bundle, no login route)
- ✓ `/login` correctly returns 404 — there is no login page

## Quick Commands to Know

**Local development:**
```bash
npm install
DATABASE_URL=postgresql://... npm run migrate
npm run dev
# Open http://localhost:3000
```

**Deploy to Vercel:**
- Push to GitHub
- Import in Vercel
- Add env vars (DATABASE_URL, GEMINI_API_KEY)
- Vercel auto-deploys
- Run migration script once

**Run migration:**
```bash
DATABASE_URL=postgresql://... npm run migrate
```

**Build for production:**
```bash
npm run build
npm start
```

## Common Questions

**Do I need a Gemini key?**
No. The app works offline. But open conversation (asking questions) needs a key. Capture commands (tasks, notes, events, images) work without it.

**Is my data private?**
It's in your own database, not shared with other users of the app (there are none — it's single-user). But there's no login wall, so anyone with your app's URL can see it. Keep the URL private, or add Vercel Deployment Protection.

**Can I export my data?**
Yes. Connect to your Neon database directly with psql or any PostgreSQL client and query the tables.

**What if I want to self-host instead of Vercel?**
Deploy the built `.next` folder to any Node.js host (Railway, Heroku, your own server).

## Next Steps

1. Read [QUICKSTART.md](./QUICKSTART.md) (5 min)
2. Deploy it
3. Use it
4. Read [README.md](./README.md) if you want to learn more
5. Read [ARCHITECTURE.md](./ARCHITECTURE.md) if you want to understand how it works

---

**You're ready. The app is tested, the docs are clear, and the code is commented. Deploy it and go.**
