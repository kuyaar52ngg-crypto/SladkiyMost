import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tariffForLoad, quote, arrivalWindow, thermoRule, wavesForDirection, billableWeightKg, finalDelivery, CONFIG } from '../public/shared/logic.js';
import { createDb, createOrder, setWaveStatus, listWaves } from '../public/shared/store.js';

test('тариф зависит от заполнения партии (таблица 1 кейса)', () => {
  assert.equal(tariffForLoad(100).rate, 500);
  assert.equal(tariffForLoad(150).rate, 500); // ровно 50% — ещё без скидки
  assert.equal(tariffForLoad(151).rate, 400); // более 50% — −20%
  assert.equal(tariffForLoad(241).rate, 325); // более 80% — −35%
});

test('волны: раз в 14 дней, приём закрывается за 3 дня', () => {
  const w = wavesForDirection('YKT-DNR', '2026-10-01', '2026-11-30');
  assert.deepEqual(w.map((x) => x.departure), ['2026-10-06', '2026-10-20', '2026-11-03', '2026-11-17']);
  assert.equal(w[1].cutoff, '2026-10-17');
});

test('межсезонье: +7 дней к сроку доставки', () => {
  assert.deepEqual(arrivalWindow('2026-09-08'), { from: '2026-09-18', to: '2026-09-22', offSeason: false });
  assert.equal(arrivalWindow('2026-11-03').from, '2026-11-20');
});

test('термоупаковка обязательна для шоколада зимой и летом', () => {
  const choc = [{ temp_sensitive: true }];
  assert.equal(thermoRule('2026-12-15', choc).required, true);
  assert.equal(thermoRule('2026-07-01', choc).required, true);
  assert.equal(thermoRule('2026-09-15', choc).required, false);
  assert.equal(thermoRule('2026-12-15', [{ temp_sensitive: false }]).required, false);
});

test('расчёт доставки: вес × тариф с учётом загрузки вместе с заказом', () => {
  const items = [{ weight_g: 1000, qty: 1, price_rub: 400, temp_sensitive: false }];
  assert.equal(billableWeightKg(1), 1.1);
  const q = quote({ items, wave: { load_kg: 150, departure: '2026-09-15' } });
  assert.equal(q.rate, 400);          // 151,1 кг > 50%
  assert.equal(q.delivery, 440);
  assert.equal(q.total, 840);
  const q2 = quote({ items, wave: { load_kg: 299.5, departure: '2026-09-15' } });
  assert.equal(q2.fits, false);       // превышение 300 кг
});

test('итоговый пересчёт: цена может только снизиться', () => {
  assert.deepEqual(finalDelivery({ weight_kg: 2, delivery_rub: 1000 }, 260), { rate: 325, final: 650, refund: 350 });
  assert.equal(finalDelivery({ weight_kg: 2, delivery_rub: 800 }, 10).final, 800);
});

test('сквозной сценарий: заказ → закрытие волны → в сборке', () => {
  const today = '2026-10-14';
  const db = createDb(today);
  const wave = listWaves(db, today, { direction: 'YKT-DNR', onlyOpen: true })[0];
  const o = createOrder(db, today, {
    items: [{ id: 'YKT-001', qty: 2 }], wave_id: wave.id, receive: 'pickup', consent: true,
    customer: { name: 'Тест', phone: '+7 (914) 000-00-01' },
    recipient: { name: 'Получатель', phone: '+7 (949) 000-00-02', pickup_point: 'Донецк' },
  });
  assert.equal(o.status, 'accepted');
  assert.equal(o.recipient.region, 'DNR');
  assert.throws(() => createOrder(db, today, { items: [{ id: 'DNR-001', qty: 1 }], wave_id: wave.id }), /региону/);
  setWaveStatus(db, wave.id, 'closed', today);
  assert.equal(o.status, 'assembling');
  assert.ok(o.final_delivery_rub <= o.delivery_rub);
  setWaveStatus(db, wave.id, 'transit', today);
  assert.equal(o.status, 'transit');
  assert.ok(CONFIG.maxLoadKg === 300);
});
