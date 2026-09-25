/* POST /api/setup — first-time setup of an empty site: creates the site owner and the first family tree.
   Only works while no accounts exist. */
const { setJSON, K, hashPw, keyOf, setSession, users, meInfo, migrate, send, body, wrap, validData, validNew } = require('./_lib');

module.exports = wrap(async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST.' });
  await migrate();
  if ((await users()).length) return send(res, 409, { error: 'This site is already set up. Sign in instead.' });
  const b = body(req);
  const bad = validNew(b.name, b.password);
  if (bad) return send(res, 400, { error: bad });
  if (!validData(b.data)) return send(res, 400, { error: 'The family data is missing or not in the right format.' });
  const u = { name: String(b.name).trim(), key: keyOf(b.name), owner: true, trees: { main: 'editor' }, ver: 1, ...hashPw(String(b.password)) };
  await setJSON(K.tree('main'), { rev: 1, data: b.data });
  await setJSON(K.trees, [{ id: 'main', name: String((b.data.meta && b.data.meta.familyName) || 'Our Family') }]);
  await setJSON(K.users, [u]);
  await setSession(res, u, true);
  send(res, 200, { me: await meInfo(u) });
});
