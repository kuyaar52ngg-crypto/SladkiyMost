// Маршруты REST API. Чистая функция над db — вызывается HTTP-сервером
// или напрямую из браузера в демо-режиме.
import * as S from './store.js';
import { CONFIG, REGIONS, DIRECTIONS, PICKUP_POINTS, ORDER_STATUSES, WAVE_STATUSES } from './logic.js';
import { CATEGORIES } from './catalog.js';

export function route(db, today, { method, path, query = {}, body = {}, admin = false }) {
  S.syncWaves(db, today);
  const m = (re) => path.match(re);
  let r;
  const needAdmin = () => { if (!admin) throw new S.ApiError(401, 'Нужен вход администратора'); };

  if (method === 'GET' && path === '/api/meta') {
    return { today, config: CONFIG, regions: REGIONS, directions: DIRECTIONS, pickupPoints: PICKUP_POINTS, categories: CATEGORIES, orderStatuses: ORDER_STATUSES, waveStatuses: WAVE_STATUSES };
  }
  if (method === 'GET' && path === '/api/products') return S.listProducts(db, query);
  if (method === 'GET' && (r = m(/^\/api\/products\/([\w-]+)$/))) return S.getProduct(db, r[1]);
  if (method === 'GET' && path === '/api/waves') {
    return query.upcoming ? S.upcomingWaves(db, today, query.direction) : S.listWaves(db, today, query);
  }
  if (method === 'POST' && path === '/api/quote') return S.quoteOrder(db, today, body);
  if (method === 'POST' && path === '/api/orders') return { order: S.orderView(db, today, S.createOrder(db, today, body)), changed: true };
  if (method === 'GET' && path === '/api/orders') return S.ordersByPhone(db, today, query.phone);
  if (method === 'GET' && (r = m(/^\/api\/orders\/([^/]+)$/))) return S.orderView(db, today, S.getOrder(db, decodeURIComponent(r[1])));
  if (method === 'POST' && (r = m(/^\/api\/orders\/([^/]+)\/cancel$/))) {
    return { order: S.orderView(db, today, S.cancelOrder(db, decodeURIComponent(r[1]), today, body.phone)), changed: true };
  }

  // ---- кабинет администратора ----
  if (method === 'POST' && path === '/api/admin/login') return { ok: admin };
  if (path.startsWith('/api/admin/')) needAdmin();
  if (method === 'GET' && path === '/api/admin/stats') return S.stats(db, today);
  if (method === 'GET' && path === '/api/admin/orders') {
    return db.orders.slice().reverse()
      .filter((o) => !query.status || o.status === query.status)
      .filter((o) => !query.wave || o.wave_id === query.wave)
      .map((o) => S.orderView(db, today, o));
  }
  if (method === 'POST' && (r = m(/^\/api\/admin\/orders\/([^/]+)\/status$/))) {
    return { order: S.setOrderStatus(db, decodeURIComponent(r[1]), body.status, today, 'Изменено администратором'), changed: true };
  }
  if (method === 'GET' && path === '/api/admin/waves') return S.listWaves(db, today, query).reverse();
  if (method === 'POST' && (r = m(/^\/api\/admin\/waves\/([^/]+)\/status$/))) {
    return { wave: S.setWaveStatus(db, decodeURIComponent(r[1]), body.status, today, 'Изменено администратором'), changed: true };
  }
  if (method === 'GET' && path === '/api/admin/products') return S.listProducts(db, { includeInactive: true });
  if (method === 'POST' && path === '/api/admin/products') return { product: S.upsertProduct(db, body), changed: true };
  if (method === 'DELETE' && (r = m(/^\/api\/admin\/products\/([\w-]+)$/))) return { product: S.deleteProduct(db, r[1]), changed: true };

  throw new S.ApiError(404, 'Маршрут не найден');
}
