/* GET /api/state[?invite=CODE] — is the site set up, who is signed in (with the trees they can open),
   the name for the sign-in screen, and whether an invite link is still good. */
const { getJSON, K, users, current, treeList, meInfo, query, migrate, send, wrap } = require('./_lib');

module.exports = wrap(async (req, res) => {
  await migrate();
  const list = await users();
  const me = list.length ? await current(req) : null;
  const trees = await treeList();
  const code = query(req).get('invite');
  let invite = null;
  if (code) {
    const inv = ((await getJSON(K.invites)) || []).find((i) => i.code === code);
    invite = { ok: !!(inv && !inv.used) };
  }
  send(res, 200, {
    setup: !list.length,
    title: trees.length === 1 ? trees[0].name : '',
    me: me ? await meInfo(me) : null,
    invite,
  });
});
