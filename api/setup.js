/* POST /api/setup — first-time setup: creates the first editor and the family data.
   Only works while no accounts exist. */
const { setJSON, K, hashPw, keyOf, setSession, users, send, body, wrap, validData, validNew } = require('./_lib');

module.exports = wrap(async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST.' });
  if ((await users()).length) return send(res, 409, { error: 'This site is already set up. Sign in instead.' });
  const b = body(req);
  const bad = validNew(b.name, b.password);
  if (bad) return send(res, 400, { error: bad });
  if (!validData(b.data)) return send(res, 400, { error: 'The family data is missing or not in the right format.' });
  const u = { name: String(b.name).trim(), key: keyOf(b.name), role: 'editor', ver: 1, ...hashPw(String(b.password)) };
  await setJSON(K.data, { rev: 1, data: b.data });
  await setJSON(K.users, [u]);
  await setSession(res, u, true);
  send(res, 200, { me: { name: u.name, role: u.role } });
});
