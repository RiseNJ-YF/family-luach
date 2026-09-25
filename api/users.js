/* GET /api/users?tree=ID — who can open this tree (its editors, read-only; the site owner).
   POST /api/users?tree=ID — {action, name, password, role, person}. The site owner manages access; the
   tree's other editors may only add viewers (a new account, or an existing one not yet in this tree):
     add    — create a new account with access to this tree
     grant  — give an existing account access to this tree (or change its role here)
     branch — limit a viewer to one person's branch of this tree (person: '' = the whole tree)
     reset  — set a new password (anyone may change their own)
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
  /* Editors may only add viewers: a new account, or an existing account that can't open this tree yet.
     Everything else (editors, role changes, other people's passwords, removing) is the site owner's. */
  if (!me.owner) {
    const selfReset = b.action === 'reset' && target && target.key === me.key;
    const addViewer = b.action === 'add' && role === 'viewer';
    const grantViewer = b.action === 'grant' && role === 'viewer' && (!target || (!target.owner && !(target.trees || {})[id]));
    if (target && b.action === 'grant' && (target.owner || (target.trees || {})[id])) return send(res, 403, { error: target.name + ' can already open this tree. Only the site owner can change their access.' });
    if (!(selfReset || addViewer || grantViewer)) return send(res, 403, { error: 'Editors can add viewers. Only the site owner can add editors, change roles, set other people’s passwords or remove people.' });
  }
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
    if (role === 'editor' && target.branch) delete target.branch[id];
    msg = had ? target.name + ' is now ' + (role === 'editor' ? 'an editor' : 'a viewer') + ' of this tree.' : target.name + ' can now open this tree as ' + (role === 'editor' ? 'an editor.' : 'a viewer.');
  } else if (b.action === 'branch') {
    if (!target || (target.trees || {})[id] !== 'viewer') return send(res, 400, { error: 'Only a viewer of this tree can be limited to one branch.' });
    target.branch = target.branch || {};
    if (b.person) target.branch[id] = String(b.person); else delete target.branch[id];
    msg = b.person ? target.name + ' now sees only that part of the family.' : target.name + ' now sees the whole tree.';
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
    if (target.branch) delete target.branch[id];
    if (!Object.keys(target.trees).length && !target.owner) {
      list = list.filter((u) => u.key !== key);
      msg = target.name + ' can no longer sign in (they had no other family tree).';
    } else msg = target.name + ' can no longer open this tree.';
  } else return send(res, 400, { error: 'Unknown action.' });

  await setJSON(K.users, list);
  if (b.action === 'reset' && target.key === me.key) await setSession(res, target, true);
  send(res, 200, { users: members(list, id, me), message: msg });
});
