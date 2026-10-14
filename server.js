// «Сладкий мост» — сервер MVP. Без внешних зависимостей: node server.js
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { route } from './public/shared/router.js';
import { createDb, ApiError } from './public/shared/store.js';
import { todayISO } from './public/shared/logic.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const DB_FILE = process.env.DB_FILE || path.join(ROOT, 'data', 'db.json');
const PORT = +process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
// TODAY=2026-12-10 позволяет показать сезонные правила на демо
const today = () => process.env.TODAY || todayISO();

let db;
function load() {
  try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { db = createDb(today()); save(); }
}
function save() {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 1));
  fs.renameSync(tmp, DB_FILE);
}
load();

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 1e6) { reject(new ApiError(413, 'Слишком большой запрос')); req.destroy(); } });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new ApiError(400, 'Некорректный JSON')); } });
  });
}

function serveStatic(req, res, pathname) {
  let file = path.normalize(path.join(PUBLIC, decodeURIComponent(pathname)));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  if (pathname === '/' || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PUBLIC, 'index.html');
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, url.pathname);
  if (url.pathname === '/api/health') return send(res, 200, { ok: true, mode: 'server' });
  try {
    const body = ['POST', 'PUT', 'DELETE'].includes(req.method) ? await readBody(req) : {};
    const wavesBefore = db.waves.length;
    const result = route(db, today(), {
      method: req.method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      body,
      admin: req.headers['x-admin-token'] === ADMIN_PASSWORD,
    });
    if (req.method !== 'GET' || db.waves.length !== wavesBefore) save();
    send(res, 200, result);
  } catch (e) {
    if (!(e instanceof ApiError)) console.error(e);
    send(res, e.status || 500, { error: e instanceof ApiError ? e.message : 'Внутренняя ошибка сервера' });
  }
});

server.listen(PORT, () => console.log(`Сладкий мост: http://localhost:${PORT}  (админ-пароль: ${ADMIN_PASSWORD === 'admin' ? 'admin' : '***'})`));
