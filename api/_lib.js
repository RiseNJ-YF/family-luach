/* Shared server code for the Family Luach API (Vercel serverless functions).
   Files starting with "_" are not exposed as routes.
   Storage: a Redis database connected through Vercel's Storage tab (Upstash REST, or a Redis URL).
   Keys: fl:users (accounts), fl:data ({rev, data}), fl:secret (signs sign-in cookies). */
const crypto = require('crypto');

let redis = null;
async function cmd(...args) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const tok = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && tok) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
      body: JSON.stringify(args.map(String)),
    });
    const j = await r.json();
    if (j.error) throw new Error('Database error: ' + j.error);
    return j.result;
  }
  const ru = process.env.REDIS_URL || process.env.KV_URL;
  if (ru) {
    if (!redis) {
      const { createClient } = require('redis');
      redis = createClient({ url: ru });
      redis.on('error', () => {});
    }
    if (!redis.isOpen) await redis.connect();
    return redis.sendCommand(args.map(String));
  }
  const e = new Error('No database is connected to this site yet. In Vercel, open the project → Storage and connect a Redis database.');
  e.code = 'NO_STORE';
  throw e;
}
async function getJSON(k) { const v = await cmd('GET', k); return v ? JSON.parse(v) : null; }
async function setJSON(k, v) { await cmd('SET', k, JSON.stringify(v)); }
const K = { users: 'fl:users', data: 'fl:data', secret: 'fl:secret' };

async function secret() {
  let s = await cmd('GET', K.secret);
  if (!s) {
    await cmd('SET', K.secret, crypto.randomBytes(32).toString('hex'), 'NX');
    s = await cmd('GET', K.secret);
  }
  return s;
}

/* Passwords: scrypt with a random salt per account. */
const SCRYPT = { N: 16384, r: 8, p: 1 };
function hashPw(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return { salt, hash: crypto.scryptSync(pw, salt, 64, SCRYPT).toString('hex') };
}
function checkPw(pw, u) {
  const h = crypto.scryptSync(String(pw), u.salt, 64, SCRYPT);
  const want = Buffer.from(u.hash, 'hex');
  return h.length === want.length && crypto.timingSafeEqual(h, want);
}
function keyOf(name) { return String(name || '').trim().toLowerCase(); }

/* Sign-in cookie: a signed token naming the account, its role and password version.
   It is re-checked against the account list on every request, so removing someone or
   resetting their password takes effect immediately. */
async function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', await secret()).update(body).digest('base64url');
  return body + '.' + mac;
}
async function verify(tok) {
  if (!tok || tok.indexOf('.') < 0) return null;
  const [body, mac] = tok.split('.');
  const want = crypto.createHmac('sha256', await secret()).update(body).digest('base64url');
  if (!mac || mac.length !== want.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(want))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.exp && Date.now() > p.exp ? null : p;
  } catch (e) { return null; }
}
function cookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((c) => {
    const i = c.indexOf('=');
    if (i > 0) out[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim());
  });
  return out;
}
const REMEMBER_DAYS = 180;
async function setSession(res, u, remember) {
  const exp = remember ? Date.now() + REMEMBER_DAYS * 864e5 : Date.now() + 12 * 3600e3;
  const tok = await sign({ k: u.key, r: u.role, v: u.ver || 1, exp });
  res.setHeader('Set-Cookie', 'fl_session=' + tok + '; Path=/; HttpOnly; Secure; SameSite=Lax' + (remember ? '; Max-Age=' + REMEMBER_DAYS * 86400 : ''));
}
function clearSession(res) { res.setHeader('Set-Cookie', 'fl_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'); }
async function users() { return (await getJSON(K.users)) || []; }
async function current(req) {
  const p = await verify(cookies(req).fl_session);
  if (!p) return null;
  const u = (await users()).find((x) => x.key === p.k);
  return u && u.role === p.r && (u.ver || 1) === p.v ? u : null;
}
function publicList(list, me) { return list.map((u) => ({ name: u.name, role: u.role, me: !!me && u.key === me.key })); }

function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}
function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch (e) { return {}; }
}
/* Every handler: JSON only for writes (blocks cross-site form posts), friendly errors. */
function wrap(fn) {
  return async (req, res) => {
    try {
      if (req.method !== 'GET' && !/application\/json/.test(req.headers['content-type'] || '')) return send(res, 415, { error: 'Send JSON.' });
      await fn(req, res);
    } catch (e) {
      send(res, e.code === 'NO_STORE' ? 503 : 500, { error: e.code === 'NO_STORE' ? e.message : 'Something went wrong on the server. Try again.' });
    }
  };
}
function validData(d) { return d && typeof d === 'object' && Array.isArray(d.people) && Array.isArray(d.marriages) && d.meta && typeof d.meta === 'object'; }
function validNew(name, pw) {
  if (!keyOf(name)) return 'Type a username.';
  if (String(name).trim().length > 40) return 'Keep the username under 40 characters.';
  if (String(pw || '').length < 6) return 'Use at least 6 characters for the password.';
  return null;
}

module.exports = { cmd, getJSON, setJSON, K, hashPw, checkPw, keyOf, setSession, clearSession, users, current, publicList, send, body, wrap, validData, validNew };
