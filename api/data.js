/* GET /api/data — the family data, for anyone signed in.
   PUT /api/data — save it (editors only). "rev" stops two editors overwriting each other. */
const { getJSON, setJSON, K, current, send, body, wrap, validData } = require('./_lib');

module.exports = wrap(async (req, res) => {
  const me = await current(req);
  if (!me) return send(res, 401, { error: 'Sign in to see the family calendar.' });
  const stored = (await getJSON(K.data)) || { rev: 0, data: null };
  if (req.method === 'GET') return send(res, 200, stored);
  if (req.method !== 'PUT') return send(res, 405, { error: 'Use GET or PUT.' });
  if (me.role !== 'editor') return send(res, 403, { error: 'Only editors can save changes.' });
  const b = body(req);
  if (!validData(b.data)) return send(res, 400, { error: 'The family data is not in the right format.' });
  if (Number(b.rev) !== stored.rev) return send(res, 409, { error: 'Someone else saved changes meanwhile.' });
  const next = { rev: stored.rev + 1, data: b.data };
  await setJSON(K.data, next);
  send(res, 200, { rev: next.rev });
});
