// Builds the self-contained clickable demo (MOVEiTcrm-demo.html) by inlining
// the real domain/events/seed/server route handlers and running them in-browser
// against an in-memory store via a tiny Express shim + client dispatcher.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(root, p), 'utf8');

// --- strip ES module syntax so the file concatenates into one script ---------
function stripModule(src) {
  // Remove import statements (single- and multi-line).
  src = src.replace(/^\s*import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '');
  src = src.replace(/^\s*import\s+['"][^'"]+['"];?\s*$/gm, '');
  return src
    .split('\n')
    .filter((l) => !/^\s*export\s*\{[^}]*\};?\s*$/.test(l))
    .map((l) => l.replace(/^(\s*)export\s+(default\s+)?/, '$1'))
    .join('\n');
}

const styles = read('public/styles.css');

// Body markup: everything inside <body>…</body> of index.html, minus the module
// script tag (we inline our own bundle instead).
const indexHtml = read('public/index.html');
const bodyInner = indexHtml
  .replace(/[\s\S]*<body>/, '')
  .replace(/<\/body>[\s\S]*/, '')
  .replace(/<script src="\/app\.js"[^>]*><\/script>\s*/, '');

const domain = stripModule(read('server/domain.js'));
const events = stripModule(read('server/events.js'));
const seed = stripModule(read('server/seed.js'));

// Server: strip modules, then re-point the Express router onto our shim.
let server = stripModule(read('server/index.js'))
  .replace(/const api = express\.Router\(\);/, 'const apiRouter = express.Router();')
  .replace(/\bapi\.(get|post|patch|put|delete|use)\(/g, 'apiRouter.$1(')
  .replace(/app\.use\('\/api', api\)/g, "app.use('/api', apiRouter)");

// Client API: reuse the real client but swap fetch for the in-memory dispatch.
let client = stripModule(read('public/api.js'))
  .replace(/async function req\(method, path, body\) \{[\s\S]*?\n\}/,
`async function req(method, path, body) {
  const [pp, qy] = path.split('?');
  const query = Object.fromEntries(new URLSearchParams(qy || ''));
  const out = await __dispatch(method, pp, query, body);
  if (out.status >= 400) throw new Error((out.data && out.data.error) || ('HTTP ' + out.status));
  return out.data;
}`);

const ui = stripModule(read('public/ui.js'));
const app = stripModule(read('public/app.js'));

const shims = `
const process = { env: {}, argv: [] };
const path = { dirname: () => '', join: (...a) => a.join('/') };
const fs = { existsSync: () => false, readFileSync: () => '{}', writeFileSync: () => {}, mkdirSync: () => {} };
const fileURLToPath = () => '';
let __ls = {};
const localStorage = { getItem: (k) => (k in __ls ? __ls[k] : null), setItem: (k, v) => { __ls[k] = String(v); } };

// --- tiny Express shim (records routes; no network) ---
function express() { return { use() {}, get() {}, listen() {} }; }
express.Router = function () {
  const _routes = [];
  const mk = (m) => (p, ...h) => { _routes.push({ m, p, h: h[h.length - 1] }); return r; };
  const r = { get: mk('GET'), post: mk('POST'), patch: mk('PATCH'), put: mk('PUT'), delete: mk('DELETE'), use() {}, _routes };
  return r;
};
express.json = () => (() => {});
express.static = () => (() => {});

// --- in-memory datastore (same surface as server/db.js) ---
const db = (() => {
  const COLLECTIONS = ['accounts','contacts','cases','deals','shipments','events','activities','agents','documents','actions','carriers','quotes','salesActivities','priceReviews','requests','risks','implementations','creditClaims','chatSessions','chatMessages','campaigns','surveys','securityGroups'];
  const empty = () => Object.fromEntries(COLLECTIONS.map((c) => [c, []]));
  const store = {
    state: empty(), _counters: {},
    load() { return this; }, save() {},
    reset(next) { this.state = { ...empty(), ...(next || {}) }; return this; },
    collection(n) { if (!this.state[n]) this.state[n] = []; return this.state[n]; },
    nextId(prefix, start = 1) { if (this._counters[prefix] == null) this._counters[prefix] = start - 1; this._counters[prefix] += 1; return prefix + '-' + this._counters[prefix]; },
    syncCounters(map) { for (const [c, cfg] of Object.entries(map)) { let max = cfg.start - 1; for (const rec of this.collection(c)) { const n = Number(String(rec.id).split('-').pop()); if (Number.isFinite(n) && n > max) max = n; } this._counters[cfg.prefix] = max; } },
    find(c, p) { return this.collection(c).find(p); },
    filter(c, p) { return this.collection(c).filter(p); },
    getById(c, id) { return this.collection(c).find((r) => r.id === id); },
    insert(c, rec) { this.collection(c).push(rec); return rec; },
    update(c, id, patch) { const rec = this.getById(c, id); if (!rec) return null; Object.assign(rec, patch, { updatedAt: new Date().toISOString() }); return rec; },
    remove(c, id) { const a = this.collection(c); const i = a.findIndex((r) => r.id === id); if (i === -1) return false; a.splice(i, 1); return true; },
  };
  return store;
})();
`;

const dispatcher = `
// --- dispatch a client call to a recorded route (Express-style, first match) ---
function __match(method, p) {
  const segs = p.split('/').filter(Boolean);
  for (const rt of apiRouter._routes) {
    if (rt.m !== method) continue;
    const rs = rt.p.split('/').filter(Boolean);
    if (rs.length !== segs.length) continue;
    const params = {}; let ok = true;
    for (let i = 0; i < rs.length; i++) { if (rs[i][0] === ':') params[rs[i].slice(1)] = decodeURIComponent(segs[i]); else if (rs[i] !== segs[i]) { ok = false; break; } }
    if (ok) return { rt, params };
  }
  return null;
}
async function __dispatch(method, p, query, body) {
  const m = __match(method, p);
  if (!m) return { status: 404, data: { error: 'Not found: ' + method + ' ' + p } };
  const out = { status: 200, data: undefined }; let err = null;
  const res = { status(c) { out.status = c; return res; }, json(d) { out.data = d; return res; }, send(d) { out.data = d; return res; }, sendFile() { return res; } };
  const next = (e) => { if (e) err = e; };
  try { await m.rt.h({ params: m.params, query: query || {}, body: body || {} }, res, next); } catch (e) { err = e; }
  if (err) { out.status = err.statusCode || (err && err.name === 'ValidationError' ? 400 : 500); out.data = { error: err.message || 'error' }; }
  return out;
}
`;

const banner = `<div id="demoBanner">Interactive demo · in-memory data (resets on reload) · <b>MOVEiTcrm</b></div>
<style>#demoBanner{position:fixed;bottom:10px;left:50%;transform:translateX(-50%);z-index:90;background:rgba(18,29,61,.92);color:#fff;font:12px/1 Inter,Arial,sans-serif;padding:7px 14px;border-radius:999px;box-shadow:0 6px 20px rgba(0,0,0,.3)}#demoBanner b{color:#ff6f66}@media(max-width:820px){#demoBanner{display:none}}</style>`;

const out = `<title>MOVEiTcrm — Interactive Demo</title>
<style>
${styles}
</style>
${bodyInner}
${banner}
<script type="module">
${shims}
// ===== domain =====
${domain}
// ===== events =====
${events}
// ===== seed =====
${seed}
// ===== server (route handlers via shim) =====
${server}
${dispatcher}
// ===== api client (in-memory) =====
${client}
// ===== ui helpers =====
${ui}
// ===== app =====
${app}
</${''}script>`;

const dest = join(root, 'MOVEiTcrm-demo.html');
writeFileSync(dest, out);
console.log('Wrote', dest, '(' + Math.round(out.length / 1024) + ' KB)');
