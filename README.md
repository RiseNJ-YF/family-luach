# Family Luach

A private family calendar and family tree: birthdays, anniversaries and yahrzeits on both the English
and Hebrew calendars, with printable PDFs (including a vector wall calendar for a plotter).

**Site:** https://risenj-yf.github.io/family-luach/

## How privacy works

This repository is public, but the family data is not readable in it:

- `index.html` is the app. It contains only a made-up example family.
- `family.enc.json` holds the real family data, **encrypted** with the family password
  (AES-256-GCM, key derived with PBKDF2-SHA256, 310,000 rounds). Without the password it is noise.
  The only readable field is the family name, which the password screen shows.
- The page encrypts the data in your browser before it is uploaded. Nobody — including GitHub —
  sees the password or the readable data.
- The page asks search engines not to index it.

Family members open the site and type the family password once per device.

## Keeping it up to date (owner)

1. **Make an access token** (one time): github.com → Settings → Developer settings →
   Personal access tokens → **Fine-grained tokens** → Generate new token.
   - Repository access: **Only select repositories** → `family-luach`
   - Repository permissions: **Contents → Read and write**
2. On the site, click **Owner sign-in** at the bottom, paste the token, and sign in.
   The token is stored only in that browser.
3. The first time: open **Settings**, import your data file (see below) or edit the example,
   then **set the family password**. That saves and publishes the encrypted data.
4. After that, edit and press **Save**. Family members see changes within a minute or two.

To move data from the Claude version: in Claude, Settings → **Download data file**; on the site,
Settings → **Import a data file…**, then Save. The same buttons make backups.

Changing the family password (Settings) re-encrypts the data; everyone then needs the new password.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | The website (built from `src/app.html`). |
| `family.enc.json` | Encrypted family data — written by the site when the owner saves. |
| `src/app.html` | App source. The same code also runs as the Claude artifact. |
| `tools/build.js` | Builds `index.html` from the source with the example family: `node tools/build.js` |
| `tools/example.json` | The made-up example family. |
| `FONT-LICENSE-Alef.txt` | License for the embedded Alef font (SIL Open Font License 1.1). |

## One-time GitHub Pages setup

Repository → Settings → Pages → Build and deployment → Source: **Deploy from a branch** →
Branch: **main**, folder **/ (root)** → Save.
