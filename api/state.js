/* GET /api/state — is the site set up, who is signed in, and the family name for the sign-in screen. */
const { getJSON, K, users, current, send, wrap } = require('./_lib');

module.exports = wrap(async (req, res) => {
  const list = await users();
  const me = list.length ? await current(req) : null;
  const stored = await getJSON(K.data);
  send(res, 200, {
    setup: !list.length,
    title: stored && stored.data && stored.data.meta ? stored.data.meta.familyName || '' : '',
    me: me ? { name: me.name, role: me.role } : null,
  });
});
