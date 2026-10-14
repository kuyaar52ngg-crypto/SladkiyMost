// Бизнес-логика «Сладкого моста»: волны, тарифы, сезонность.
// Модуль общий для сервера (Node) и браузера — расчёт везде одинаковый.

export const CONFIG = {
  waveIntervalDays: 14,       // 1 раз в 14 дней в каждом направлении
  cutoffDaysBefore: 3,        // приём заказов закрывается за 3 дня до отправки
  transitDays: [10, 14],      // срок доставки партии
  offSeasonExtraDays: 7,      // межсезонье (май, ноябрь): +7 дней
  baseTariff: 500,            // руб. за 1 кг
  minLoadKg: 50,              // минимальная загрузка партии для отправки
  maxLoadKg: 300,             // максимальная загрузка партии
  discounts: [                // снижение тарифа от заполнения партии
    { over: 0.8, percent: 35 },
    { over: 0.5, percent: 20 },
  ],
  thermoPrice: 150,           // термоупаковка, руб. за заказ
  packagingFactor: 1.1,       // допущение: упаковка добавляет 10 % к массе нетто
  minBillableKg: 0.5,         // допущение: минимальный тарифицируемый вес
  giftBoxPrice: 250,          // подарочная коробка с лентой и открыткой
  pickupPrice: 0,             // пункт выдачи — бесплатно
  courierPrice: 150,          // курьер до адреса в городе получения
  // Опорные даты отправок (дальше — каждые 14 дней)
  anchors: { 'YKT-DNR': '2026-10-20', 'DNR-YKT': '2026-10-27' },
};

export const REGIONS = {
  YKT: { id: 'YKT', name: 'Якутия', showcase: 'Сладости Якутии', city: 'Якутск', gen: 'Якутии' },
  DNR: { id: 'DNR', name: 'Донбасс', showcase: 'Сладости Донбасса', city: 'Донецк', gen: 'Донбасса' },
};

export const DIRECTIONS = {
  'YKT-DNR': { id: 'YKT-DNR', from: 'YKT', to: 'DNR', title: 'Якутия → Донбасс' },
  'DNR-YKT': { id: 'DNR-YKT', from: 'DNR', to: 'YKT', title: 'Донбасс → Якутия' },
};

export const PICKUP_POINTS = {
  YKT: ['Якутск, пр. Ленина, 1 — пункт выдачи «Сладкий мост»', 'Якутск, ул. Кирова, 18 — ТЦ «Центральный»'],
  DNR: ['Донецк, ул. Артёма, 130 — пункт выдачи «Сладкий мост»', 'Макеевка, пр. Ленинский, 22 — пункт выдачи'],
};

export const ORDER_STATUSES = [
  { id: 'accepted', title: 'Принят' },
  { id: 'assembling', title: 'В сборке' },
  { id: 'transit', title: 'В пути' },
  { id: 'pickup', title: 'На пункте выдачи' },
  { id: 'received', title: 'Получен' },
];
export const CANCELLED = { id: 'cancelled', title: 'Отменён' };

export const WAVE_STATUSES = {
  collecting: 'Идёт сбор',
  closed: 'Сбор закрыт',
  transit: 'В пути',
  arrived: 'Прибыла',
  done: 'Завершена',
  postponed: 'Перенесена',
};

// Статус заказов, который выставляется при смене статуса волны
export const WAVE_TO_ORDER_STATUS = { closed: 'assembling', transit: 'transit', arrived: 'pickup' };

// ---------- даты ----------
const DAY = 86400000;
export function parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); }
export function fmtISO(d) { return d.toISOString().slice(0, 10); }
export function addDays(s, n) { return fmtISO(new Date(parseDate(s).getTime() + n * DAY)); }
export function diffDays(a, b) { return Math.round((parseDate(a) - parseDate(b)) / DAY); }
export function todayISO(now = new Date()) {
  return fmtISO(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}
export function monthOf(s) { return parseDate(s).getUTCMonth() + 1; }

const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export function fmtDate(s, withYear = false) {
  const d = parseDate(s);
  return `${d.getUTCDate()} ${MONTHS_GEN[d.getUTCMonth()]}${withYear ? ' ' + d.getUTCFullYear() : ''}`;
}
export function fmtRange(a, b) {
  const da = parseDate(a), db = parseDate(b);
  if (da.getUTCMonth() === db.getUTCMonth()) return `${da.getUTCDate()}–${db.getUTCDate()} ${MONTHS_GEN[db.getUTCMonth()]}`;
  return `${fmtDate(a)} – ${fmtDate(b)}`;
}
export function rub(n) { return `${Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ')} ₽`; }
export function kg(n) { return `${(Math.round(n * 10) / 10).toLocaleString('ru-RU')} кг`; }

// ---------- сезонность (таблица 2 кейса) ----------
export function seasonInfo(month) {
  if ([12, 1, 2].includes(month)) return { kind: 'frost', thermoRequired: true, text: 'Морозы: шоколадным изделиям обязательна термоупаковка (защита от мороза).' };
  if ([6, 7, 8].includes(month)) return { kind: 'heat', thermoRequired: true, text: 'Жара: шоколадным изделиям обязательна термоупаковка (защита от перегрева).' };
  if ([5, 11].includes(month)) return { kind: 'offseason', thermoRequired: false, extraDays: CONFIG.offSeasonExtraDays, text: 'Межсезонье на Лене (ледостав/ледоход): срок доставки увеличен на 7 дней.' };
  return { kind: 'none', thermoRequired: false, text: 'Сезонных ограничений нет.' };
}

// Окно прибытия волны с учётом межсезонья (по месяцу отправки и месяцу прибытия)
export function arrivalWindow(departure) {
  let [min, max] = CONFIG.transitDays;
  const months = [monthOf(departure), monthOf(addDays(departure, max))];
  const offSeason = months.some((m) => m === 5 || m === 11);
  if (offSeason) { min += CONFIG.offSeasonExtraDays; max += CONFIG.offSeasonExtraDays; }
  return { from: addDays(departure, min), to: addDays(departure, max), offSeason };
}

// Нужна ли термоупаковка: шоколадные товары + морозный/жаркий месяц отправки или прибытия
export function thermoRule(departure, items) {
  const sensitive = items.some((i) => i.temp_sensitive);
  const arr = arrivalWindow(departure);
  const months = [monthOf(departure), monthOf(arr.from), monthOf(arr.to)];
  const risky = months.map(seasonInfo).find((s) => s.thermoRequired);
  return {
    sensitive,
    required: sensitive && !!risky,
    reason: sensitive && risky ? risky.text : sensitive ? 'В заказе шоколадные изделия. Сейчас термоупаковка по желанию.' : '',
  };
}

// ---------- волны ----------
export function wavesForDirection(direction, fromISO, toISO) {
  const anchor = CONFIG.anchors[direction];
  const step = CONFIG.waveIntervalDays;
  const k0 = Math.floor(diffDays(fromISO, anchor) / step);
  const out = [];
  for (let k = k0; ; k++) {
    const departure = addDays(anchor, k * step);
    if (departure > toISO) break;
    if (departure < fromISO) continue;
    out.push({
      id: `${direction}-${departure}`,
      direction,
      departure,
      cutoff: addDays(departure, -CONFIG.cutoffDaysBefore),
      ...(() => { const a = arrivalWindow(departure); return { arrivalFrom: a.from, arrivalTo: a.to, offSeason: a.offSeason }; })(),
    });
  }
  return out;
}

export function isWaveOpen(wave, today) {
  return wave.status === 'collecting' && today <= wave.cutoff;
}

// Тариф за кг при заданной загрузке
export function tariffForLoad(loadKg) {
  const fill = loadKg / CONFIG.maxLoadKg;
  for (const d of CONFIG.discounts) {
    if (fill > d.over) return { rate: CONFIG.baseTariff * (1 - d.percent / 100), percent: d.percent, fill };
  }
  return { rate: CONFIG.baseTariff, percent: 0, fill };
}

// Следующий порог скидки для мотивации («ещё N кг до тарифа ...»)
export function nextDiscount(loadKg) {
  const thresholds = [...CONFIG.discounts].sort((a, b) => a.over - b.over);
  for (const d of thresholds) {
    const kgAt = d.over * CONFIG.maxLoadKg;
    if (loadKg <= kgAt) return { needKg: Math.max(0.1, kgAt - loadKg + 0.1), rate: CONFIG.baseTariff * (1 - d.percent / 100), percent: d.percent };
  }
  return null;
}

export function netWeightKg(items) {
  return items.reduce((s, i) => s + (i.weight_g * i.qty) / 1000, 0);
}
export function billableWeightKg(netKg) {
  if (netKg <= 0) return 0;
  return Math.max(CONFIG.minBillableKg, Math.ceil(netKg * CONFIG.packagingFactor * 10) / 10);
}

// Главный расчёт: стоимость доставки заказа в выбранной волне.
// items: [{weight_g, qty, price_rub, temp_sensitive}], wave: {load_kg, departure,...}
export function quote({ items, wave, thermo = false, gift = false, receive = 'pickup' }) {
  const goods = items.reduce((s, i) => s + i.price_rub * i.qty, 0);
  const net = netWeightKg(items);
  const weight = billableWeightKg(net);
  const currentLoad = wave.load_kg || 0;
  const projectedLoad = currentLoad + weight;
  const fits = projectedLoad <= CONFIG.maxLoadKg;
  const t = tariffForLoad(projectedLoad);
  const delivery = Math.round(weight * t.rate);
  const baseDelivery = Math.round(weight * CONFIG.baseTariff);
  const th = thermoRule(wave.departure, items);
  const thermoApplied = th.required || !!thermo;
  const thermoCost = thermoApplied ? CONFIG.thermoPrice : 0;
  const giftCost = gift ? CONFIG.giftBoxPrice : 0;
  const receiveCost = receive === 'courier' ? CONFIG.courierPrice : CONFIG.pickupPrice;
  const total = goods + delivery + thermoCost + giftCost + receiveCost;
  return {
    goods, netKg: net, weightKg: weight,
    currentLoad, projectedLoad, fill: projectedLoad / CONFIG.maxLoadKg, fits,
    rate: t.rate, discountPercent: t.percent,
    delivery, baseDelivery, saving: baseDelivery - delivery,
    next: nextDiscount(projectedLoad),
    thermo: { ...th, applied: thermoApplied, cost: thermoCost },
    giftCost, receiveCost, total,
    minReached: projectedLoad >= CONFIG.minLoadKg,
  };
}

// Итоговый пересчёт при закрытии волны: цена может только снизиться
export function finalDelivery(order, waveFinalLoad) {
  const t = tariffForLoad(waveFinalLoad);
  const recalculated = Math.round(order.weight_kg * t.rate);
  const final = Math.min(order.delivery_rub, recalculated);
  return { rate: t.rate, final, refund: order.delivery_rub - final };
}

export function statusTitle(id) {
  return (ORDER_STATUSES.find((s) => s.id === id) || CANCELLED).title;
}
