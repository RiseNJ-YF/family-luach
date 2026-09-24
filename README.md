# Family Luach

A private family calendar and family tree: birthdays, anniversaries and yahrzeits on both the English
and Hebrew calendars, with printable PDFs (including a vector wall calendar for a plotter).

**Site:** https://family-luach-beta.vercel.app/

Hosted on **Vercel** (free plan), with the family data and accounts in a private Redis database
connected through Vercel's Storage tab.

## Signing in

Everyone signs in with a **username and password**:

- **Viewer** — sees the calendar, family tree and people, and can export PDFs.
- **Editor** — can also add and change people, save, and manage who can sign in.

Editors add people, set passwords and remove people in **Settings → People who can sign in**.
Forgot a password? An editor sets a new one. Removing someone or resetting their password signs them
out everywhere immediately.

## First-time setup (once)

1. Open the site and click **Set it up (first editor)**.
2. Choose your username and password and the family name. Optionally attach a data file from the
   Claude version (Claude → Settings → **Download data file**).
3. Click **Create the family site**, then add family members in Settings.

## How it works

- `index.html` — the app. It contains only a made-up example family; real data never goes into the
  repository.
- `api/` — small serverless functions: sign-in (`login`, `logout`, `state`), first-time `setup`,
  the family `data` (anyone signed in can read; editors save), and `users` (editors manage accounts).
- Passwords are stored as scrypt hashes. Sign-in uses a signed, HttpOnly cookie that is re-checked
  against the account list on every request. Ten wrong passwords lock a username for 15 minutes.
- Data lives in the Redis database (`fl:data`, `fl:users`); nothing personal is in this repository.

## Changing the app

- Source: `src/app.html` (the same code also runs as the Claude artifact).
- Rebuild the page: `node tools/build.js` → commit → push. Vercel redeploys automatically.
- Test locally without Vercel: `node tools/dev-server.js`, then open http://localhost:5393
  (an in-memory database; nothing is saved when it stops).
