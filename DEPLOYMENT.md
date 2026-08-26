# Deployment Guide

## Prerequisites

- GitHub account (for version control)
- Vercel account (free, sign in with GitHub)
- Neon account (free, for PostgreSQL)
- Google account (for Gemini API key, optional but recommended)

## Step 1: Set Up the Database (Neon)

1. Go to [neon.tech](https://neon.tech) and sign up (free)
2. Create a new project
3. In the project dashboard, click **Connect**
4. Select **Node.js** from the dropdown
5. You'll see a connection string starting with `postgresql://`. Copy the entire string.
   - **Important**: Use the **pooled** connection string (it says "Pooler" in the UI), not the regular one.
6. Save this string — you'll need it in Vercel env vars.

## Step 2: Get a Gemini API Key (Optional but Recommended)

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Click **Create API Key**
3. Copy the key and save it somewhere safe
4. The free tier is generous enough for personal use.
5. If you skip this step, the app will work in offline mode (no open conversation, but tasks/notes still work).

## Step 3: Push to GitHub

1. Create a new repo on GitHub called `nimbus-assistant` (or whatever you like). **Make it private** — since there's no login wall on the app, you don't want the source or, more importantly, your deployment URL, easily discoverable.
2. In the repo root (the folder with `package.json`):
   ```bash
   git init
   git add .
   git commit -m "initial commit: nimbus assistant"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/nimbus-assistant.git
   git push -u origin main
   ```

## Step 4: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in (GitHub is easiest)
2. Click **Add New** → **Project**
3. Select **Import Git Repository**
4. Paste your GitHub repo URL and click **Continue**
5. Vercel will auto-detect Next.js. Click **Deploy**.
6. **Before the deployment finishes**, go back to the project settings and add environment variables:

   | Variable | Value | Source |
   |----------|-------|--------|
   | `DATABASE_URL` | The pooled connection string from Neon | Neon dashboard |
   | `GEMINI_API_KEY` | Your API key from aistudio.google.com | Google AI Studio |
   | `AI_PROVIDER` | `gemini` | Hard-coded |

7. Click **Save** and Vercel will redeploy with the env vars.
8. Once the deployment is green, click **Visit** to see your app live.

## Step 5: Run the Database Migration

The database schema is in `db/schema.sql`. On the first run, you need to apply it:

### Option A: From Your Local Machine

```bash
# Make sure you have the repo cloned locally
cd nimbus-assistant
npm install
DATABASE_URL="<your-neon-pooled-connection-string>" npm run migrate
```

### Option B: Via Vercel CLI

```bash
npm install -g vercel
vercel link  # Follow the prompts to link to your Vercel project
vercel env pull  # Downloads env vars locally
DATABASE_URL="..." npm run migrate
```

The migration script (`scripts/migrate.mjs`) reads `db/schema.sql` and applies it to your database. It's idempotent — you can run it multiple times safely.

## Step 6: Open and Test

1. Visit your Vercel deployment URL (e.g., `https://nimbus-assistant.vercel.app`)
2. There's no sign-up — it opens straight into the chat
3. Your timezone will auto-detect; you can change it in the Clock page
4. Try these commands in the chat:
   - `add task buy groceries tomorrow 6pm`
   - `note: ideas for the next project`
   - `schedule meeting with Alice friday 2pm`
   - `image of a sunset over the mountains`
   - `what are my tasks`

## Keeping the App Private

Because Nimbus has no login page, **anyone with the URL can see and edit your data**. A few options, from simplest to most robust:

1. **Just keep the URL secret.** Vercel URLs (`your-app.vercel.app`) aren't indexed or guessable. This is enough for most personal use.
2. **Vercel Deployment Protection.** In your Vercel project settings, under **Deployment Protection**, you can require a Vercel login or a password to view the site at all. This is the easiest built-in option.
3. **Add your own gate.** If you want a simple password prompt without a full accounts system, you can add a single shared password check in middleware — ask if you'd like this added back in as a lightweight option instead of full accounts.

## Troubleshooting Deployment

### "DATABASE_URL is not set" error after deployment

This usually means the env var didn't get applied before the build. Redeploy:
1. Go to your Vercel project dashboard
2. Click **Deployments**
3. Find the latest deployment, click the three dots, and click **Redeploy**

### "Connection refused" when the app tries to use the database

This means the app can reach Vercel but not Neon. Check:
1. The `DATABASE_URL` is pasted correctly (no extra spaces)
2. It uses the **pooled** connection string (not the regular one)
3. The Neon project is active (go to neon.tech and check)

### Tasks are created but don't show up in the Tasks page

After a chat message creates a task, the chat fetches fresh events. If you don't see it:
1. Hard-refresh the Tasks page (Cmd+Shift+R or Ctrl+Shift+R)
2. Check your timezone setting (might be filtering by date)
3. Check the Neon dashboard to see if the row was actually written

### "GEMINI_API_KEY is invalid" error

1. Make sure the key is copied exactly (no extra spaces)
2. Check that you grabbed it from [aistudio.google.com/apikey](https://aistudio.google.com/apikey), not a different Google API console
3. If the key is old, regenerate it in AI Studio

### Images don't load or show 404

Pollinations (the free image generator) generates images on demand. They can take 10–30 seconds. Refresh after a moment.

## Keeping It Running

### Update the app

To deploy updates:
```bash
# Make changes locally
git add .
git commit -m "description of changes"
git push origin main
# Vercel auto-redeploys on every push
```

### Monitor the database

Neon free tier includes 3 GB storage. To check usage:
1. Go to [neon.tech](https://neon.tech)
2. Click your project
3. Go to **Storage** to see current usage

For most personal use, you won't come close to 3 GB.

### View logs

Vercel stores logs of every deployment. To view them:
1. Go to your Vercel project dashboard
2. Click **Deployments** → the latest one
3. Click **Logs** at the top

## Scaling Beyond Free

If you hit Vercel's free tier limits:
- Upgrade to **Vercel Pro** ($20/month) for higher limits

If you hit Gemini's free quota:
- Switch to a paid Gemini tier, or
- Use **DeepSeek** (cheaper, check their pricing)

Neon's free tier is generous and unlikely to be a bottleneck for a personal app.

## Security Checklist

- [ ] `DATABASE_URL` uses the pooled connection and includes `sslmode=require`
- [ ] `GEMINI_API_KEY` is set only in Vercel env vars, not in your repo
- [ ] Your GitHub repo is **private**
- [ ] You've decided how to keep your deployment URL private (see "Keeping the App Private" above)

---

That's it! Your app is live and free.
