/* GET /api/trees — every family tree on the site, with how many people can open it (site owner only).
   POST /api/trees — {action:"create", name} starts a new, empty family tree (site owner only). */
const { setJSON, K, newId, users, current, treeList, meInfo, migrate, send, body, wrap } = require('./_lib');

function emptyFamily(name) { return { meta: { familyName: name }, people: [], marriages: [] }; }

module.exports = wrap(async (req, res) => {
  await migrate();
  const me = await current(req);
  if (!me) return send(res, 401, { error: 'Sign in first.' });
  if (!me.owner) return send(res, 403, { error: 'Only the site owner can do that.' });
  const trees = await treeList();
  if (req.method === 'GET') {
    const list = await users();
    return send(res, 200, { trees: trees.map((t) => ({ id: t.id, name: t.name, people: list.filter((u) => (u.trees || {})[t.id]).length })) });
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'Use GET or POST.' });
  const b = body(req);
  if (b.action !== 'create') return send(res, 400, { error: 'Unknown action.' });
  const name = String(b.name || '').trim() || 'New Family';
  if (name.length > 80) return send(res, 400, { error: 'Keep the family name under 80 characters.' });
  const id = newId();
  await setJSON(K.tree(id), { rev: 1, data: emptyFamily(name) });
  trees.push({ id, name });
  await setJSON(K.trees, trees);
  send(res, 200, { id, me: await meInfo(me) });
});
