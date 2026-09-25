/* GET /api/data?tree=ID — one family tree's data, for anyone with access to it.
   PUT /api/data?tree=ID — save it (that tree's editors). "rev" stops two editors overwriting each other. */
const { getJSON, setJSON, K, current, roleIn, treeList, query, migrate, send, body, wrap, validData } = require('./_lib');

module.exports = wrap(async (req, res) => {
  await migrate();
  const me = await current(req);
  if (!me) return send(res, 401, { error: 'Sign in to see the family calendar.' });
  const id = query(req).get('tree') || '';
  const trees = await treeList();
  const tree = trees.find((t) => t.id === id);
  const role = roleIn(me, id);
  if (!tree || !role) return send(res, 403, { error: 'You don’t have access to that family tree.' });
  const stored = (await getJSON(K.tree(id))) || { rev: 0, data: null };
  if (req.method === 'GET') return send(res, 200, stored);
  if (req.method !== 'PUT') return send(res, 405, { error: 'Use GET or PUT.' });
  if (role !== 'editor') return send(res, 403, { error: 'Only editors can save changes.' });
  const b = body(req);
  if (!validData(b.data)) return send(res, 400, { error: 'The family data is not in the right format.' });
  if (Number(b.rev) !== stored.rev) return send(res, 409, { error: 'Someone else saved changes meanwhile.' });
  const next = { rev: stored.rev + 1, data: b.data };
  await setJSON(K.tree(id), next);
  /* keep the tree's name in the list in step with the family name */
  const name = String((b.data.meta && b.data.meta.familyName) || '').trim();
  if (name && name !== tree.name) { tree.name = name; await setJSON(K.trees, trees); }
  send(res, 200, { rev: next.rev });
});
