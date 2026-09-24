/* GET /api/users — the account list (editors only).
   POST /api/users — {action:"add"|"reset"|"remove", name, password, role} (editors only). */
const { setJSON, K, hashPw, keyOf, setSession, users, current, publicList, send, body, wrap, validNew } = require('./_lib');

module.exports = wrap(async (req, res) => {
  const me = await current(req);
  if (!me) return send(res, 401, { error: 'Sign in first.' });
  if (me.role !== 'editor') return send(res, 403, { error: 'Only editors can manage who can sign in.' });
  let list = await users();
  if (req.method === 'GET') return send(res, 200, { users: publicList(list, me) });
  if (req.method !== 'POST') return send(res, 405, { error: 'Use GET or POST.' });

  const b = body(req);
  const key = keyOf(b.name);
  const target = list.find((u) => u.key === key);
  let msg;
  if (b.action === 'add') {
    const bad = validNew(b.name, b.password);
    if (bad) return send(res, 400, { error: bad });
    if (target) return send(res, 400, { error: 'There’s already someone called “' + String(b.name).trim() + '”.' });
    const role = b.role === 'editor' ? 'editor' : 'viewer';
    list.push({ name: String(b.name).trim(), key, role, ver: 1, ...hashPw(String(b.password)) });
    msg = String(b.name).trim() + ' can now sign in as ' + (role === 'editor' ? 'an editor.' : 'a viewer.');
  } else if (b.action === 'reset') {
    if (!target) return send(res, 404, { error: 'That person isn’t on the list.' });
    if (String(b.password || '').length < 6) return send(res, 400, { error: 'Use at least 6 characters for the password.' });
    Object.assign(target, hashPw(String(b.password)), { ver: (target.ver || 1) + 1 });
    msg = target.key === me.key ? 'Your password is changed.' : 'New password set for ' + target.name + '.';
  } else if (b.action === 'remove') {
    if (!target) return send(res, 404, { error: 'That person isn’t on the list.' });
    if (target.key === me.key) return send(res, 400, { error: 'You can’t remove yourself.' });
    if (target.role === 'editor' && list.filter((u) => u.role === 'editor').length < 2) return send(res, 400, { error: 'Keep at least one editor.' });
    list = list.filter((u) => u.key !== key);
    msg = target.name + ' can no longer sign in.';
  } else return send(res, 400, { error: 'Unknown action.' });

  await setJSON(K.users, list);
  if (b.action === 'reset' && target.key === me.key) await setSession(res, target, true);
  send(res, 200, { users: publicList(list, me), message: msg });
});
