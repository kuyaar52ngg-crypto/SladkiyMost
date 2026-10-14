// Операции с данными маркетплейса. Работают над простым объектом db,
// поэтому один и тот же код используется сервером (JSON-файл) и браузером
// в демо-режиме (localStorage).
import {
  CONFIG, DIRECTIONS, REGIONS, ORDER_STATUSES, WAVE_TO_ORDER_STATUS,
  wavesForDirection, addDays, quote, finalDelivery, isWaveOpen, tariffForLoad, statusTitle,
} from './logic.js';
import { PRODUCTS } from './catalog.js';

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Детерминированная «загрузка от других покупателей» для демо-волн
function demoLoad(waveId, kind) {
  let h = 0;
  for (const c of waveId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  if (kind === 'past') return 190 + (h % 95);
  if (kind === 'current') return waveId.startsWith('YKT') ? 128 : 196;
  return 8 + (h % 30);
}

export function createDb(today) {
  const db = { version: 1, seq: 1024, products: PRODUCTS.map((p) => ({ ...p, active: true })), waves: [], orders: [] };
  syncWaves(db, today);
  seedOrders(db, today);
  return db;
}

export function syncWaves(db, today) {
  const from = addDays(today, -56), to = addDays(today, 42);
  for (const dir of Object.keys(DIRECTIONS)) {
    for (const w of wavesForDirection(dir, from, to)) {
      if (db.waves.some((x) => x.id === w.id)) continue;
      const past = w.cutoff < today;
      const firstOpen = !past && !db.waves.some((x) => x.direction === dir && x.cutoff >= today);
      let status = 'collecting';
      if (past) {
        if (today < w.departure) status = 'closed';
        else if (today < w.arrivalFrom) status = 'transit';
        else if (today <= addDays(w.arrivalTo, 5)) status = 'arrived';
        else status = 'done';
      }
      db.waves.push({
        ...w, status, history: [],
        seed_load_kg: demoLoad(w.id, past ? 'past' : firstOpen ? 'current' : 'future'),
      });
    }
  }
  // автоматическое закрытие приёма по сроку
  for (const w of db.waves) {
    if (w.status === 'collecting' && today > w.cutoff) setWaveStatus(db, w.id, 'closed', today, 'Автоматически: истёк срок приёма');
  }
  db.waves.sort((a, b) => a.departure.localeCompare(b.departure));
}

export function waveLoad(db, wave) {
  return Math.round((wave.seed_load_kg + db.orders
    .filter((o) => o.wave_id === wave.id && o.status !== 'cancelled')
    .reduce((s, o) => s + o.weight_kg, 0)) * 10) / 10;
}

export function publicWave(db, wave, today) {
  const load = waveLoad(db, wave);
  const t = tariffForLoad(load);
  return {
    ...wave,
    load_kg: load,
    fill: load / CONFIG.maxLoadKg,
    rate: t.rate,
    discount: t.percent,
    open: isWaveOpen(wave, today) && load < CONFIG.maxLoadKg,
    days_left: Math.max(0, Math.round((Date.parse(wave.cutoff) - Date.parse(today)) / 86400000)),
    orders_count: db.orders.filter((o) => o.wave_id === wave.id && o.status !== 'cancelled').length,
    title: DIRECTIONS[wave.direction].title,
  };
}

export function listWaves(db, today, { direction, onlyOpen } = {}) {
  return db.waves
    .filter((w) => !direction || w.direction === direction)
    .map((w) => publicWave(db, w, today))
    .filter((w) => !onlyOpen || w.open);
}

// Ближайшие волны для покупателя: открытые + одна последняя закрытая (для контекста)
export function upcomingWaves(db, today, direction) {
  const all = listWaves(db, today, { direction });
  const open = all.filter((w) => w.open).slice(0, 3);
  const lastClosed = all.filter((w) => !w.open && w.departure >= addDays(today, -3) && w.status !== 'collecting').slice(-1);
  return [...open, ...lastClosed];
}

export function listProducts(db, { region, category, q, min, max, sort, includeInactive } = {}) {
  let list = db.products.filter((p) => includeInactive || p.active);
  if (region) list = list.filter((p) => region.split(',').includes(p.region));
  if (category) list = list.filter((p) => category.split(',').includes(p.category));
  if (q) { const s = q.toLowerCase(); list = list.filter((p) => (p.name + ' ' + p.description + ' ' + p.category).toLowerCase().includes(s)); }
  if (min) list = list.filter((p) => p.price_rub >= +min);
  if (max) list = list.filter((p) => p.price_rub <= +max);
  if (sort === 'price_asc') list = [...list].sort((a, b) => a.price_rub - b.price_rub);
  if (sort === 'price_desc') list = [...list].sort((a, b) => b.price_rub - a.price_rub);
  if (sort === 'popular') { const pop = popularity(db); list = [...list].sort((a, b) => (pop[b.id] || 0) - (pop[a.id] || 0)); }
  return list;
}

export function getProduct(db, id) {
  const p = db.products.find((x) => x.id === id);
  if (!p) throw new ApiError(404, 'Товар не найден');
  return p;
}

function resolveItems(db, items) {
  if (!Array.isArray(items) || !items.length) throw new ApiError(400, 'Корзина пуста');
  const out = items.map(({ id, qty }) => {
    const p = getProduct(db, id);
    if (!p.active) throw new ApiError(400, `«${p.name}» сейчас недоступен`);
    const n = Math.max(1, Math.min(50, Math.floor(+qty || 1)));
    return { id: p.id, name: p.name, region: p.region, photo: p.photo, weight_g: p.weight_g, price_rub: p.price_rub, temp_sensitive: p.temp_sensitive, qty: n };
  });
  const regions = new Set(out.map((i) => i.region));
  if (regions.size > 1) throw new ApiError(400, 'В одну отправку входят сладости одного региона');
  return out;
}

export function quoteOrder(db, today, body) {
  const items = resolveItems(db, body.items);
  const wave = db.waves.find((w) => w.id === body.wave_id);
  if (!wave) throw new ApiError(404, 'Волна не найдена');
  if (DIRECTIONS[wave.direction].from !== items[0].region) throw new ApiError(400, 'Волна не соответствует региону товаров');
  const pw = publicWave(db, wave, today);
  const q = quote({ items, wave: pw, thermo: !!body.thermo, gift: !!body.gift, receive: body.receive });
  return { items, wave: pw, quote: q };
}

const PHONE_RE = /^[+\d][\d\s()-]{9,}$/;
function req(v, msg) { if (!v || !String(v).trim()) throw new ApiError(400, msg); return String(v).trim().slice(0, 300); }

export function createOrder(db, today, body) {
  const { items, wave, quote: q } = quoteOrder(db, today, body);
  if (!wave.open) throw new ApiError(409, 'Приём заказов в эту волну закрыт — выберите следующую');
  if (!q.fits) throw new ApiError(409, 'Партия заполнена — выберите следующую волну');
  const customer = { name: req(body.customer?.name, 'Укажите ваше имя'), phone: req(body.customer?.phone, 'Укажите ваш телефон') };
  if (!PHONE_RE.test(customer.phone)) throw new ApiError(400, 'Проверьте номер телефона');
  const dest = DIRECTIONS[wave.direction].to;
  const r = body.recipient || {};
  const recipient = {
    name: req(r.name, 'Укажите имя получателя'),
    phone: req(r.phone, 'Укажите телефон получателя'),
    region: dest,
    city: REGIONS[dest].city,
    receive: body.receive === 'courier' ? 'courier' : 'pickup',
    address: body.receive === 'courier' ? req(r.address, 'Укажите адрес доставки') : req(r.pickup_point, 'Выберите пункт выдачи'),
  };
  if (!body.consent) throw new ApiError(400, 'Нужно согласие с условиями заказа');
  const gift = body.gift ? {
    message: String(body.giftMessage || '').slice(0, 200),
    signature: String(body.giftSignature || '').slice(0, 60),
    card: String(body.giftCard || 'classic').slice(0, 20),
    surprise: !!body.giftSurprise,
  } : null;
  const order = {
    id: `СМ-${++db.seq}`,
    created: today,
    created_at: new Date().toISOString(),
    customer, recipient, gift,
    kind: gift ? 'gift' : (body.b2b ? 'b2b' : 'self'),
    company: body.b2b ? String(body.company || '').slice(0, 120) : undefined,
    items,
    direction: wave.direction,
    wave_id: wave.id,
    goods_rub: q.goods,
    weight_kg: q.weightKg,
    rate_rub: q.rate,
    delivery_rub: q.delivery,
    thermo_rub: q.thermo.cost,
    gift_rub: q.giftCost,
    receive_rub: q.receiveCost,
    total_rub: q.total,
    refund_rub: 0,
    payment: { method: body.payment === 'sbp' ? 'СБП' : 'Банковская карта', status: 'paid', note: 'Оплата — имитация (заглушка)' },
    status: 'accepted',
    history: [{ status: 'accepted', date: today, note: 'Заказ принят и оплачен' }],
  };
  db.orders.push(order);
  return order;
}

export function getOrder(db, id) {
  const o = db.orders.find((x) => x.id.toLowerCase() === String(id).toLowerCase().replace('cm', 'см'));
  if (!o) throw new ApiError(404, 'Заказ не найден');
  return o;
}

export function orderView(db, today, o) {
  const w = db.waves.find((x) => x.id === o.wave_id);
  return { ...o, wave: w ? publicWave(db, w, today) : null, status_title: statusTitle(o.status) };
}

const digits = (s) => String(s || '').replace(/\D/g, '').slice(-10);
export function ordersByPhone(db, today, phone) {
  const d = digits(phone);
  if (d.length < 10) return [];
  return db.orders.filter((o) => digits(o.customer.phone) === d || digits(o.recipient.phone) === d)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((o) => orderView(db, today, o));
}

export function setOrderStatus(db, id, status, today, note) {
  const o = getOrder(db, id);
  if (status !== 'cancelled' && !ORDER_STATUSES.some((s) => s.id === status)) throw new ApiError(400, 'Неизвестный статус');
  if (o.status === status) return o;
  o.status = status;
  o.history.push({ status, date: today, note: note || '' });
  return o;
}

export function cancelOrder(db, id, today, phone) {
  const o = getOrder(db, id);
  if (phone && digits(o.customer.phone) !== digits(phone)) throw new ApiError(403, 'Нет доступа к заказу');
  if (o.status !== 'accepted') throw new ApiError(409, 'Заказ уже собирается — отмена через поддержку');
  setOrderStatus(db, id, 'cancelled', today, 'Отменён покупателем, деньги возвращены (имитация)');
  return o;
}

export function setWaveStatus(db, id, status, today, note) {
  const w = db.waves.find((x) => x.id === id);
  if (!w) throw new ApiError(404, 'Волна не найдена');
  if (!['collecting', 'closed', 'transit', 'arrived', 'done', 'postponed'].includes(status)) throw new ApiError(400, 'Неизвестный статус');
  const prev = w.status;
  w.status = status;
  w.history = w.history || [];
  w.history.push({ status, date: today, note: note || '' });
  const orders = db.orders.filter((o) => o.wave_id === id && o.status !== 'cancelled');
  if (status === 'closed' && prev === 'collecting') {
    // итоговый пересчёт доставки по фактической загрузке — цена может только снизиться
    const load = waveLoad(db, w);
    w.final_load_kg = load;
    w.final_rate = tariffForLoad(load).rate;
    for (const o of orders) {
      const f = finalDelivery(o, load);
      o.final_delivery_rub = f.final;
      o.refund_rub = f.refund;
    }
  }
  if (status === 'postponed') {
    // партия не набрала минимум — заказы переносятся в следующую волну направления
    const next = db.waves.find((x) => x.direction === w.direction && x.departure > w.departure && x.status === 'collecting');
    if (next) for (const o of orders) {
      o.wave_id = next.id;
      o.history.push({ status: o.status, date: today, note: `Перенесён в волну ${next.departure}: партия не набрала ${CONFIG.minLoadKg} кг` });
    }
  }
  const os = WAVE_TO_ORDER_STATUS[status];
  if (os) for (const o of orders) if (o.status !== 'received') setOrderStatus(db, o.id, os, today, `Волна: ${status}`);
  return w;
}

export function upsertProduct(db, data) {
  const fields = ['name', 'region', 'manufacturer', 'category', 'weight_g', 'price_rub', 'temp_sensitive', 'shelf_life_days', 'photo', 'description', 'composition', 'tag', 'active'];
  let p = data.id && db.products.find((x) => x.id === data.id);
  if (!p) {
    const region = data.region === 'DNR' ? 'DNR' : 'YKT';
    const n = db.products.filter((x) => x.region === region).length + 1;
    let id;
    for (let k = n; ; k++) { id = `${region}-${String(k).padStart(3, '0')}`; if (!db.products.some((x) => x.id === id)) break; }
    p = { id, active: true, photo: 'img/gift.jpg', composition: '', tag: '' };
    db.products.push(p);
  }
  for (const f of fields) if (data[f] !== undefined) p[f] = data[f];
  p.weight_g = Math.max(1, +p.weight_g || 0);
  p.price_rub = Math.max(1, +p.price_rub || 0);
  p.shelf_life_days = +p.shelf_life_days || 0;
  p.temp_sensitive = !!p.temp_sensitive;
  if (!p.name) throw new ApiError(400, 'Укажите название');
  return p;
}

export function deleteProduct(db, id) {
  const p = getProduct(db, id);
  p.active = false; // мягкое удаление — сохраняем историю заказов
  return p;
}

function popularity(db) {
  const pop = {};
  for (const o of db.orders) if (o.status !== 'cancelled') for (const i of o.items) pop[i.id] = (pop[i.id] || 0) + i.qty;
  return pop;
}

export function stats(db, today) {
  const valid = db.orders.filter((o) => o.status !== 'cancelled');
  const revenue = valid.reduce((s, o) => s + o.total_rub, 0);
  const pop = popularity(db);
  const top = Object.entries(pop).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([id, qty]) => ({ id, qty, name: db.products.find((p) => p.id === id)?.name || id }));
  const byStatus = Object.fromEntries([...ORDER_STATUSES, { id: 'cancelled' }].map((s) => [s.id, db.orders.filter((o) => o.status === s.id).length]));
  // встречная загрузка: ближайшая открытая волна в каждом направлении
  const counter = Object.keys(DIRECTIONS).map((dir) => {
    const w = listWaves(db, today, { direction: dir, onlyOpen: true })[0];
    // прогноз: средняя загрузка прошлых волн направления
    const past = db.waves.filter((x) => x.direction === dir && x.cutoff < today).slice(-4);
    const forecast = past.length ? Math.round(past.reduce((s, x) => s + waveLoad(db, x), 0) / past.length) : null;
    return { direction: dir, title: DIRECTIONS[dir].title, wave: w || null, forecast_kg: forecast };
  });
  const commission = Math.round(valid.reduce((s, o) => s + o.goods_rub, 0) * 0.15);
  return {
    orders: valid.length, revenue, avg_check: valid.length ? Math.round(revenue / valid.length) : 0,
    gifts: valid.filter((o) => o.gift).length, top, byStatus, counter, commission_estimate: commission,
  };
}

function seedOrders(db, today) {
  const P = (id) => db.products.find((p) => p.id === id);
  const mk = (wave, items, extra) => {
    const its = items.map(([id, qty]) => ({ ...P(id), qty }));
    const pw = publicWave(db, wave, today);
    const q = quote({ items: its, wave: { ...pw, load_kg: pw.load_kg - 0 }, gift: !!extra.gift, receive: 'pickup' });
    const o = {
      id: `СМ-${++db.seq}`, created: extra.created, created_at: extra.created + 'T09:00:00.000Z',
      customer: { name: 'Анна Морозова', phone: '+7 (914) 123-45-67' },
      recipient: extra.recipient, gift: extra.gift || null, kind: extra.gift ? 'gift' : 'self',
      items: its.map(({ id, name, region, photo, weight_g, price_rub, temp_sensitive, qty }) => ({ id, name, region, photo, weight_g, price_rub, temp_sensitive, qty })),
      direction: wave.direction, wave_id: wave.id, goods_rub: q.goods, weight_kg: q.weightKg, rate_rub: q.rate,
      delivery_rub: q.delivery, thermo_rub: q.thermo.cost, gift_rub: q.giftCost, receive_rub: 0, total_rub: q.total, refund_rub: 0,
      payment: { method: 'Банковская карта', status: 'paid', note: 'Оплата — имитация (заглушка)' },
      status: 'accepted', history: [{ status: 'accepted', date: extra.created, note: 'Заказ принят и оплачен' }],
    };
    db.orders.push(o);
    for (const s of extra.statuses || []) { o.status = s; o.history.push({ status: s, date: extra.created, note: '' }); }
    return o;
  };
  const byDir = (dir) => db.waves.filter((w) => w.direction === dir);
  const pastDNR = byDir('DNR-YKT').filter((w) => w.cutoff < today);
  const openYKT = byDir('YKT-DNR').find((w) => w.status === 'collecting');
  const done = pastDNR[pastDNR.length - 3];
  const transit = pastDNR[pastDNR.length - 1] || pastDNR[0];
  const toYkt = { name: 'Анна Морозова', phone: '+7 (914) 123-45-67', region: 'YKT', city: 'Якутск', receive: 'pickup', address: 'Якутск, пр. Ленина, 1 — пункт выдачи «Сладкий мост»' };
  if (done) mk(done, [['DNR-001', 1], ['DNR-002', 2]], { created: addDays(done.cutoff, -4), recipient: toYkt, statuses: ['assembling', 'transit', 'pickup', 'received'] });
  if (transit) mk(transit, [['DNR-003', 2], ['DNR-005', 1]], { created: addDays(transit.cutoff, -2), recipient: toYkt, statuses: transit.status === 'collecting' ? [] : ['assembling', ...(['transit', 'arrived', 'done'].includes(transit.status) ? ['transit'] : [])] });
  if (openYKT) mk(openYKT, [['YKT-001', 2], ['YKT-005', 1]], {
    created: today,
    recipient: { name: 'Елена Морозова', phone: '+7 (949) 555-24-18', region: 'DNR', city: 'Донецк', receive: 'pickup', address: 'Донецк, ул. Артёма, 130 — пункт выдачи «Сладкий мост»' },
    gift: { message: 'Мама, пусть этот подарок напомнит о наших чаепитиях. Обнимаю, даже когда далеко.', signature: 'Твоя Аня', card: 'classic', surprise: true },
  });
}
