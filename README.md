# Family Luach

A private family calendar and family tree: birthdays, anniversaries and yahrzeits on both the English
and Hebrew calendars, with printable PDFs (including a vector wall calendar for a plotter).

**Site:** https://risenj-yf.github.io/family-luach/

## Signing in

Everyone signs in with a **username and password**. There are two kinds of accounts:

- **Viewer** — sees the calendar, family tree and people, and can export PDFs.
- **Editor** — can also add and change people, save, and manage who can sign in.

Editors add people, set their passwords and remove them in **Settings → People who can sign in**.
Forgot a password? An editor sets a new one.

## How privacy works

This repository is public, but nothing personal in it is readable:

- `index.html` is the app. It contains only a made-up example family.
- `family.enc.json` holds the real family data **encrypted** (AES-256-GCM) with a random family key.
  Each account's password (PBKDF2-SHA256, 310,000 rounds) unlocks a copy of that key.
  Editors' passwords also unlock the GitHub key the site uses to save.
- Usernames are stored only as hashes. The family name is the one readable field — the sign-in
  screen shows it.
- All encryption happens in the browser; GitHub never sees passwords or readable data.

## First-time setup (the first editor, once)

1. Open the site and click **Set it up (first editor)**.
2. Follow step 1 on that screen to make a **GitHub key** (a fine-grained personal access token):
   repository access **Only select repositories → family-luach**, permission **Contents: Read and write**,
   the longest expiration offered. Paste it in.
3. Choose your username and password, the family name, and optionally a data file from the Claude
   version (Claude → Settings → **Download data file**).
4. Click **Create the family site**, then add family members in Settings.

Nobody needs the GitHub key after that. If it expires, saving stops with a message; an editor makes
a new key and pastes it in **Settings → GitHub key**.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | The website (built from `src/app.html`). |
| `family.enc.json` | Encrypted family data and accounts — written by the site. |
| `src/app.html` | App source. The same code also runs as the Claude artifact. |
| `tools/build.js` | Builds `index.html` with the example family: `node tools/build.js` |
| `tools/example.json` | The made-up example family. |
| `tools/serve-test.js` | Local test server for a copy in `.test/` (git-ignored). |
| `FONT-LICENSE-Alef.txt` | License for the embedded Alef font (SIL Open Font License 1.1). |
