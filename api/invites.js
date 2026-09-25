/* Invite links for starting a new family tree. Only the site owner makes them.
   GET  /api/invites — open and used invites (owner).
   POST /api/invites — {action:"create"} (owner) · {action:"revoke", code} (owner)
                     · {action:"accept", code, family, name, password} — anyone with a good link:
     starts a new, empty family tree and makes them its editor. They can sign in with an existing account
     (username + its password) or choose a new username; someone already signed in only names the family.
   Each link works once. */
const crypto = require('crypto');
const { cmd, getJSON, setJSON, K, newId, hashPw, checkPw, keyOf, setSession, users, current, treeList, meInfo, migrate, send, body, wrap, validNew } = require('./_lib');

function emptyFamily(name) { return { meta: { familyName: name }, people: [], marriages: [] }; }

module.exports = wrap(async (req, res) => {
  await migrate();
  const me = await current(req);
  const invites = (await getJSON(K.invites)) || [];
  const b = req.method === 'POST' ? body(req) : {};

  if (req.method === 'POST' && b.action === 'accept') {
    const inv = invites.find((i) => i.code === b.code);
    if (!inv || inv.used) return send(res, 410, { error: 'This invite link has already been used or was cancelled. Ask for a new one.' });
    const family = String(b.family || '').trim();
    if (!family) return send(res, 400, { error: 'Type a name for your family tree.' });
    if (family.length > 80) return send(res, 400, { error: 'Keep the family name under 80 characters.' });
    let list = await users();
    let u = me;
    if (!u) {
      const key = keyOf(b.name);
      const existing = list.find((x) => x.key === key);
      if (existing) {
        const failKey = 'fl:fail:' + key;
        if (Number(await cmd('GET', failKey)) >= 10) return send(res, 429, { error: 'Too many wrong tries for this username. Wait 15 minutes and try again.' });
        if (!checkPw(b.password || '', existing)) {
          await cmd('INCR', failKey); await cmd('EXPIRE', failKey, 900);
          return send(res, 401, { error: 'That username is taken. If it’s yours, type its password; otherwise choose another username.' });
        }
        u = existing;
      } else {
        const bad = validNew(b.name, b.password);
        if (bad) return send(res, 400, { error: bad });
        u = { name: String(b.name).trim(), key, trees: {}, ver: 1, ...hashPw(String(b.password)) };
        list.push(u);
      }
    } else u = list.find((x) => x.key === me.key);
    const id = newId();
    await setJSON(K.tree(id), { rev: 1, data: emptyFamily(family) });
    const trees = await treeList();
    trees.push({ id, name: family });
    await setJSON(K.trees, trees);
    u.trees = u.trees || {};
    u.trees[id] = 'editor';
    await setJSON(K.users, list);
    inv.used = Date.now(); inv.usedBy = u.name; inv.tree = family;
    await setJSON(K.invites, invites);
    await setSession(res, u, true);
    return send(res, 200, { id, me: await meInfo(u) });
  }

  if (!me) return send(res, 401, { error: 'Sign in first.' });
  if (!me.owner) return send(res, 403, { error: 'Only the site owner can make invite links.' });
  if (req.method === 'GET') return send(res, 200, { invites });
  if (req.method !== 'POST') return send(res, 405, { error: 'Use GET or POST.' });
  if (b.action === 'create') {
    const inv = { code: crypto.randomBytes(12).toString('base64url'), created: Date.now(), by: me.name };
    invites.push(inv);
    await setJSON(K.invites, invites);
    return send(res, 200, { invites, code: inv.code });
  }
  if (b.action === 'revoke') {
    const left = invites.filter((i) => i.code !== b.code);
    await setJSON(K.invites, left);
    return send(res, 200, { invites: left });
  }
  send(res, 400, { error: 'Unknown action.' });
});
