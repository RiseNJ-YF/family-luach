/* GET /api/users?tree=ID — who can open this tree (its editors only).
   POST /api/users?tree=ID — {action, name, password, role}, for this tree's editors:
     add    — create a new account with access to this tree
     grant  — give an existing account access to this tree (or change its role here)
     reset  — set a new password (for accounts that only belong to trees you edit, or yourself;
              the site owner can reset anyone)
     remove — take away access to this tree (an account left with no tree at all is deleted) */
const { setJSON, K, hashPw, keyOf, setSession, users, current, roleIn, treeList, members, query, migrate, send, body, wrap, validNew } = require('./_lib');

module.exports = wrap(async (req, res) => {
  await migrate();
  const me = await current(req);
  if (!me) return send(res, 401, { error: 'Sign in first.' });
  const id = query(req).get('tree') || '';
  if (!(await treeList()).some((t) => t.id === id)) return send(res, 404, { error: 'That family tree doesn’t exist.' });
  if (roleIn(me, id) !== 'editor') return send(res, 403, { error: 'Only this tree’s editors can manage who can open it.' });
  let list = await users();
  if (req.method === 'GET') return send(res, 200, { users: members(list, id, me) });
  if (req.method !== 'POST') return send(res, 405, { error: 'Use GET or POST.' });

  const b = body(req);
  const key = keyOf(b.name);
  const target = list.find((u) => u.key === key);
  const role = b.role === 'editor' ? 'editor' : 'viewer';
  let msg;
  if (b.action === 'add') {
    const bad = validNew(b.name, b.password);
    if (bad) return send(res, 400, { error: bad });
    if (target) return send(res, 400, { error: 'There’s already an account called “' + String(b.name).trim() + '”. To give it access, use “Give an existing user access”.' });
    list.push({ name: String(b.name).trim(), key, trees: { [id]: role }, ver: 1, ...hashPw(String(b.password)) });
    msg = String(b.name).trim() + ' can now sign in as ' + (role === 'editor' ? 'an editor' : 'a viewer') + ' of this tree.';
  } else if (b.action === 'grant') {
    if (!target) return send(res, 404, { error: 'There’s no account called “' + String(b.name || '').trim() + '”. Check the spelling, or add them as a new person.' });
    if (target.owner) return send(res, 400, { error: target.name + ' is the site owner and can already open every tree.' });
    if (target.key === me.key) return send(res, 400, { error: 'You can’t change your own access.' });
    target.trees = target.trees || {};
    const had = target.trees[id];
    target.trees[id] = role;
    msg = had ? target.name + ' is now ' + (role === 'editor' ? 'an editor' : 'a viewer') + ' of this tree.' : target.name + ' can now open this tree as ' + (role === 'editor' ? 'an editor.' : 'a viewer.');
  } else if (b.action === 'reset') {
    if (!target) return send(res, 404, { error: 'That person isn’t on the list.' });
    const mine = target.key === me.key;
    const allowed = mine || me.owner || (!target.owner && Object.keys(target.trees || {}).every((t) => roleIn(me, t) === 'editor'));
    if (!allowed) return send(res, 403, { error: target.name + ' also belongs to other family trees, so only the site owner can set their password.' });
    if (String(b.password || '').length < 6) return send(res, 400, { error: 'Use at least 6 characters for the password.' });
    Object.assign(target, hashPw(String(b.password)), { ver: (target.ver || 1) + 1 });
    msg = mine ? 'Your password is changed.' : 'New password set for ' + target.name + '.';
  } else if (b.action === 'remove') {
    if (!target || !(target.trees || {})[id]) return send(res, 404, { error: 'That person doesn’t have access to this tree.' });
    if (target.key === me.key) return send(res, 400, { error: 'You can’t remove yourself.' });
    delete target.trees[id];
    if (!Object.keys(target.trees).length && !target.owner) {
      list = list.filter((u) => u.key !== key);
      msg = target.name + ' can no longer sign in (they had no other family tree).';
    } else msg = target.name + ' can no longer open this tree.';
  } else return send(res, 400, { error: 'Unknown action.' });

  await setJSON(K.users, list);
  if (b.action === 'reset' && target.key === me.key) await setSession(res, target, true);
  send(res, 200, { users: members(list, id, me), message: msg });
});
