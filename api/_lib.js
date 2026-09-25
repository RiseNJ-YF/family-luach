/* Shared server code for the Family Luach API (Vercel serverless functions).
   Files starting with "_" are not exposed as routes.
   Storage: a Redis database connected through Vercel's Storage tab (Upstash REST, or a Redis URL).
   Keys: fl:users (accounts), fl:trees (list of family trees), fl:tree:<id> ({rev, data} of one tree),
   fl:invites (links for starting a new tree), fl:secret (signs sign-in cookies).
   One login per person; each account has a role per tree ({trees: {<id>: 'editor'|'viewer'}}).
   The site owner (owner: true) can open and edit every tree, and is the only one who manages who can open
   a tree (and in what role), sets other people's passwords, and makes invites.
   A viewer can be limited to one branch of a tree ({branch: {<id>: <personId>}}): the server then only
   sends that person, their parents, everyone below them and their husbands/wives. */
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
const K = { users: 'fl:users', data: 'fl:data', secret: 'fl:secret', trees: 'fl:trees', invites: 'fl:invites', tree: (id) => 'fl:tree:' + id };
function newId() { return crypto.randomBytes(6).toString('hex'); }

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
  const tok = await sign({ k: u.key, v: u.ver || 1, exp });
  res.setHeader('Set-Cookie', 'fl_session=' + tok + '; Path=/; HttpOnly; Secure; SameSite=Lax' + (remember ? '; Max-Age=' + REMEMBER_DAYS * 86400 : ''));
}
function clearSession(res) { res.setHeader('Set-Cookie', 'fl_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'); }
async function users() { return (await getJSON(K.users)) || []; }
async function current(req) {
  const p = await verify(cookies(req).fl_session);
  if (!p) return null;
  const u = (await users()).find((x) => x.key === p.k);
  return u && (u.ver || 1) === p.v ? u : null;
}
/* Role of an account in one tree: the owner edits everything. */
function roleIn(u, id) { return u ? (u.owner ? 'editor' : (u.trees || {})[id] || null) : null; }
async function treeList() { return (await getJSON(K.trees)) || []; }
async function treesFor(u) {
  const all = await treeList();
  return all.filter((t) => roleIn(u, t.id)).map((t) => ({ id: t.id, name: t.name, role: roleIn(u, t.id), branch: !!branchOf(u, t.id) }));
}
async function meInfo(u) { return { name: u.name, owner: !!u.owner, trees: await treesFor(u) }; }
function query(req) { return new URL(req.url || '/', 'http://x').searchParams; }
/* Members of one tree, for its editors. */
function members(list, id, me) {
  return list.filter((u) => (u.trees || {})[id] || u.owner).map((u) => ({ name: u.name, role: u.owner ? 'owner' : u.trees[id], branch: (!u.owner && u.trees[id] === 'viewer' && (u.branch || {})[id]) || '', mine: !!me && (u.by || {})[id] === me.key, me: !!me && u.key === me.key }));
}
function branchOf(u, id) { return u && !u.owner && (u.trees || {})[id] === 'viewer' ? (u.branch || {})[id] || '' : ''; }
/* The part of a family a branch viewer may see: the starting person, their parents, all their
   descendants, and the husbands/wives of all of those. Anyone else is left out entirely; a kept person
   whose parent is left out keeps that parent's Hebrew first name in their own record, so their name
   (בן/בת …) still reads right. */
function branchData(d, pid) {
  const byId = {};
  (d.people || []).forEach((p) => { byId[p.id] = p; });
  if (!byId[pid]) return { meta: d.meta, people: [], marriages: [] };
  const kids = {};
  d.people.forEach((p) => (p.parents || []).forEach((q) => { (kids[q] = kids[q] || []).push(p.id); }));
  const keep = new Set([pid]), line = [pid];
  for (let i = 0; i < line.length; i++) (kids[line[i]] || []).forEach((k) => { if (!keep.has(k)) { keep.add(k); line.push(k); } });
  const blood = new Set(keep);
  (d.marriages || []).forEach((m) => {
    if (blood.has(m.a) && m.b && byId[m.b]) keep.add(m.b);
    if (m.b && blood.has(m.b) && byId[m.a]) keep.add(m.a);
  });
  (byId[pid].parents || []).forEach((q) => { if (byId[q]) keep.add(q); });
  const people = d.people.filter((p) => keep.has(p.id)).map((p) => {
    const c = Object.assign({}, p);
    (p.parents || []).forEach((q) => {
      if (keep.has(q) || !byId[q]) return;
      const par = byId[q];
      if (par.gender === 'm' && !c.fatherHeb) c.fatherHeb = par.hebFirst || '';
      if (par.gender === 'f' && !c.motherHeb) c.motherHeb = par.hebFirst || '';
    });
    c.parents = (p.parents || []).filter((q) => keep.has(q));
    return c;
  });
  const marriages = (d.marriages || []).filter((m) => keep.has(m.a) && (!m.b || keep.has(m.b) || !byId[m.b]));
  return { meta: d.meta, people, marriages };
}
/* One-time move from the single-family version: the family becomes tree "main", everyone keeps their
   role there, and the first editor becomes the site owner. The old fl:data key is kept as a backup. */
async function migrate() {
  if (await cmd('GET', K.trees)) return;
  const list = await users();
  const old = await getJSON(K.data);
  if (!list.length && !old) return;
  const name = (old && old.data && old.data.meta && old.data.meta.familyName) || 'Our Family';
  if (old && !(await cmd('GET', K.tree('main')))) await setJSON(K.tree('main'), old);
  let ownerSet = list.some((u) => u.owner);
  list.forEach((u) => {
    if (!u.trees) u.trees = { main: u.role === 'editor' ? 'editor' : 'viewer' };
    if (!ownerSet && (u.role === 'editor' || u.trees.main === 'editor')) { u.owner = true; ownerSet = true; }
    delete u.role;
  });
  await setJSON(K.users, list);
  await setJSON(K.trees, [{ id: 'main', name }]);
}

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

module.exports = { cmd, getJSON, setJSON, K, newId, hashPw, checkPw, keyOf, setSession, clearSession, users, current, roleIn, treeList, treesFor, meInfo, query, members, branchOf, branchData, migrate, send, body, wrap, validData, validNew };
