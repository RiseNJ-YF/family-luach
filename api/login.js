/* POST /api/login — sign in with username + password. Ten wrong tries lock that username for 15 minutes. */
const { cmd, checkPw, keyOf, setSession, users, meInfo, migrate, send, body, wrap } = require('./_lib');

module.exports = wrap(async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST.' });
  await migrate();
  const b = body(req);
  const key = keyOf(b.name);
  const failKey = 'fl:fail:' + key;
  if (Number(await cmd('GET', failKey)) >= 10) return send(res, 429, { error: 'Too many wrong tries for this username. Wait 15 minutes and try again.' });
  const u = (await users()).find((x) => x.key === key);
  if (!u || !checkPw(b.password || '', u)) {
    await cmd('INCR', failKey);
    await cmd('EXPIRE', failKey, 900);
    return send(res, 401, { error: 'That username and password don’t match. Check both and try again.' });
  }
  await cmd('DEL', failKey);
  await setSession(res, u, !!b.remember);
  send(res, 200, { me: await meInfo(u) });
});
