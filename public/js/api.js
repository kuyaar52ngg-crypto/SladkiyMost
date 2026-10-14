// Клиент API. Если сервер доступен — работаем с ним; если сайт открыт
// со статического хостинга, включается демо-режим: тот же роутер
// выполняется в браузере, данные хранятся в localStorage.
import { route } from '../shared/router.js';
import { createDb } from '../shared/store.js';
import { todayISO } from '../shared/logic.js';

const LS_DB = 'sm-demo-db-v1';
let mode = null;
let localDb = null;

function adminToken() { try { return localStorage.getItem('sm-admin') || ''; } catch { return ''; } }

async function detect() {
  if (mode) return mode;
  try {
    const r = await fetch('api/health', { cache: 'no-store' });
    const j = r.ok ? await r.json() : null;
    mode = j && j.ok ? 'server' : 'local';
  } catch { mode = 'local'; }
  return mode;
}

function today() { return new URLSearchParams(location.search).get('today') || todayISO(); }

function getLocalDb() {
  if (localDb) return localDb;
  try { localDb = JSON.parse(localStorage.getItem(LS_DB)); } catch { localDb = null; }
  if (!localDb) localDb = createDb(today());
  return localDb;
}
function saveLocalDb() { try { localStorage.setItem(LS_DB, JSON.stringify(localDb)); } catch { /* приватный режим */ } }

export async function api(method, path, body) {
  const m = await detect();
  let [p, qs] = path.split('?');
  if (m === 'server') {
    const r = await fetch(p.replace(/^\//, '') + (qs ? '?' + qs : ''), {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Admin-Token': adminToken() },
      body: body ? JSON.stringify(body) : undefined,
    });
    const j = await r.json().catch(() => ({ error: 'Ошибка сети' }));
    if (!r.ok) { const e = new Error(j.error || 'Ошибка'); e.status = r.status; throw e; }
    return j;
  }
  const db = getLocalDb();
  try {
    const res = route(db, today(), {
      method, path: p, query: Object.fromEntries(new URLSearchParams(qs || '')), body: body || {},
      admin: adminToken() === 'admin',
    });
    saveLocalDb();
    return JSON.parse(JSON.stringify(res));
  } catch (e) {
    const err = new Error(e.message); err.status = e.status || 500; throw err;
  }
}

export const apiMode = () => mode;
export function resetDemo() { localStorage.removeItem(LS_DB); localDb = null; }
