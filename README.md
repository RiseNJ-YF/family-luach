# Family Luach

A private family calendar and family tree: birthdays, anniversaries and yahrzeits on both the English
and Hebrew calendars, with printable PDFs (including a vector wall calendar for a plotter).

**Site:** https://family-luach-beta.vercel.app/

Hosted on **Vercel** (free plan), with the family data and accounts in a private Redis database
connected through Vercel's Storage tab.

## Family trees and signing in

One site can hold several family trees. Everyone has **one username and password**, and a role in
each tree they can open:

- **Viewer** — sees that tree's calendar, family tree and people, and can export PDFs.
- **Editor** — can also change that tree and manage who can open it.
- **Site owner** (the first editor) — can open and edit every tree, start new trees, and create
  **invite links**. An invite link works once: whoever opens it names their family, becomes the editor
  of a new, empty tree, and adds their own people.

Editors manage access in **Settings → People who can open this tree**: add a new person, give an
existing user access, switch someone between viewer and editor, set passwords, or remove them.
Someone removed from their only tree can no longer sign in. People who belong to more than one tree
switch between them with the menu at the top of the page.

## First-time setup (once)

1. Open the site and click **Set it up (first editor)**.
2. Choose your username and password and the family name. Optionally attach a data file from the
   Claude version (Claude → Settings → **Download data file**).
3. Click **Create the family site**, then add family members in Settings.

## How it works

- `index.html` — the app. It contains only a made-up example family; real data never goes into the
  repository.
- `api/` — small serverless functions: sign-in (`login`, `logout`, `state`), first-time `setup`,
  a tree's `data` (its members read; its editors save), `users` (a tree's editors manage access), and
  `trees` and `invites` (site owner).
- Passwords are stored as scrypt hashes. Sign-in uses a signed, HttpOnly cookie that is re-checked
  against the account list on every request. Ten wrong passwords lock a username for 15 minutes.
- Data lives in the Redis database (`fl:trees`, `fl:tree:<id>`, `fl:users`, `fl:invites`); nothing
  personal is in this repository. `fl:data` holds the single-family data from before trees existed and
  is kept as a backup.

## Changing the app

- Source: `src/app.html` (the same code also runs as the Claude artifact).
- Rebuild the page: `node tools/build.js` → commit → push. Vercel redeploys automatically.
- Test locally without Vercel: `node tools/dev-server.js`, then open http://localhost:5393
  (an in-memory database; nothing is saved when it stops).
