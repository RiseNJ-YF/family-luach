/* POST /api/logout — sign out on this device. */
const { clearSession, send, wrap } = require('./_lib');

module.exports = wrap(async (req, res) => {
  clearSession(res);
  send(res, 200, { ok: true });
});
