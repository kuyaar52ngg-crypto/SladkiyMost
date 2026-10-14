'use client';
import { useEffect, useMemo, useState } from 'react';
import { Info } from '@/features/account/parts';
import { AdminHead, Bars, Kpi, Panel, WAVE_PILL } from '@/features/admin/ui';
import { useShop } from '@/features/shop/store';
import { get } from '@/shared/api/client';
import type { Order, Product, RegionId, Wave, WaveStatus } from '@/shared/api/types';
import { rub } from '@/shared/lib/format';

const PERIODS = [['30', 'Последние 30 дней'], ['7', 'Последние 7 дней'], ['90', 'Последние 90 дней'], ['', 'За всё время']] as const;
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 1000) / 10}%` : '—');

export default function Analytics() {
  const { meta } = useShop();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [waves, setWaves] = useState<Wave[]>([]);
  const [period, setPeriod] = useState('30');
  useEffect(() => {
    get<Order[]>('/api/admin/orders').then(setOrders).catch(() => setOrders([]));
    get<Product[]>('/api/admin/products').then(setProducts).catch(() => null);
    get<Wave[]>('/api/admin/waves').then(setWaves).catch(() => null);
  }, []);

  const a = useMemo(() => {
    const since = period ? Date.now() - Number(period) * 86400000 : 0;
    const list = (orders || []).filter((o) => o.status !== 'cancelled' && (!since || new Date(o.created_at).getTime() >= since));
    const cat = new Map(products.map((p) => [p.id, p.category]));
    const byCat = new Map<string, number>(), byProduct = new Map<string, [string, number, number]>();
    const byRegion = new Map<RegionId, [number, number]>(), byManufacturer = new Map<string, [number, number]>();
    const made = new Map(products.map((p) => [p.id, p.manufacturer || 'Без производителя']));
    for (const o of list) {
      const r = byRegion.get(o.recipient.region) || [0, 0];
      byRegion.set(o.recipient.region, [r[0] + 1, r[1] + o.goods_rub]);
      const seen = new Set<string>();
      for (const i of o.items) {
        const sum = i.price_rub * i.qty, c = cat.get(i.id) || 'Другое', m = made.get(i.id) || 'Без производителя';
        byCat.set(c, (byCat.get(c) || 0) + sum);
        const p = byProduct.get(i.id) || [i.name, 0, 0];
        byProduct.set(i.id, [i.name, p[1] + i.qty, p[2] + sum]);
        const mm = byManufacturer.get(m) || [0, 0];
        byManufacturer.set(m, [mm[0] + (seen.has(m) ? 0 : 1), mm[1] + sum]);
        seen.add(m);
      }
    }
    const goods = list.reduce((s, o) => s + o.goods_rub, 0);
    return { list, goods, byCat: [...byCat].sort((x, y) => y[1] - x[1]), byRegion: [...byRegion], byManufacturer: [...byManufacturer].sort((x, y) => y[1][1] - x[1][1]),
      top: [...byProduct.values()].sort((x, y) => y[1] - x[1]).slice(0, 6) };
  }, [orders, products, period]);

  const wavesBy = (Object.keys(WAVE_PILL) as WaveStatus[]).map((s) => [s, waves.filter((w) => w.status === s && w.orders_count > 0)] as const).filter(([, l]) => l.length);
  if (!orders) return <p className="text-muted">Загружаем…</p>;

  return (
    <>
      <AdminHead title="Аналитика маркетплейса" text="Суммы по товарам без доставки, отменённые заказы не учитываются." />
      <label className="field max-w-[360px]"><span className="label">Период</span>
        <select className="select" value={period} onChange={(e) => setPeriod(e.target.value)}>{PERIODS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Kpi title="Заказы" value={a.list.length} hint={`${a.list.filter((o) => o.gift).length} подарочных`} />
        <Kpi title="Объём за товары" value={rub(a.goods)} hint="Без доставки и упаковки" />
        <Kpi title="Средний чек" value={rub(a.list.length ? a.goods / a.list.length : 0)} hint="По товарам" />
        <Kpi title="Сборные партии" value={waves.filter((w) => w.orders_count > 0).length} hint={`${waves.filter((w) => w.status === 'collecting' && w.orders_count > 0).length} формируется`} />
      </div>

      <Panel className="mt-6" title="Распределение объёма по категориям">
        <span className="pill">тыс. ₽</span>
        <div className="mt-5">{a.byCat.length ? <Bars data={a.byCat.map(([c, v]) => [c, Math.round(v / 100) / 10])} /> : <p className="text-sm text-muted">Нет заказов за период.</p>}</div>
      </Panel>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <Panel title="Производители">
          <table className="table-x"><thead><tr><th>Производитель</th><th>Заказов</th><th>Товары</th><th>Доля</th></tr></thead>
            <tbody>{a.byManufacturer.map(([m, [n, s]]) => <tr key={m}><td className="font-semibold">{m}</td><td>{n}</td><td>{rub(s)}</td><td className="text-accent">{pct(s, a.goods)}</td></tr>)}
              {!a.byManufacturer.length && <tr><td colSpan={4} className="text-muted">Нет данных</td></tr>}</tbody></table>
        </Panel>
        <Panel title="Регионы получения">
          <table className="table-x"><thead><tr><th>Регион</th><th>Заказы</th><th>Объём</th></tr></thead>
            <tbody>{a.byRegion.map(([r, [n, s]]) => <tr key={r}><td className="font-semibold">{meta.regions[r].name}</td><td>{n}</td><td className="text-accent">{rub(s)}</td></tr>)}
              {!a.byRegion.length && <tr><td colSpan={3} className="text-muted">Нет данных</td></tr>}</tbody></table>
        </Panel>
        <Panel title="Категории">
          <table className="table-x"><thead><tr><th>Категория</th><th>Сумма</th><th>Доля</th></tr></thead>
            <tbody>{a.byCat.map(([c, s]) => <tr key={c}><td className="font-semibold">{c}</td><td className="text-accent">{rub(s)}</td><td>{pct(s, a.goods)}</td></tr>)}
              {!a.byCat.length && <tr><td colSpan={3} className="text-muted">Нет данных</td></tr>}</tbody></table>
        </Panel>
        <Panel title="Сборные партии">
          <table className="table-x"><thead><tr><th>Состояние</th><th>Партий</th><th>Заказов</th></tr></thead>
            <tbody>{wavesBy.map(([s, l]) => <tr key={s}><td className="font-semibold">{WAVE_PILL[s]}</td><td>{l.length}</td><td className="text-accent">{l.reduce((x, w) => x + w.orders_count, 0)}</td></tr>)}
              {!wavesBy.length && <tr><td colSpan={3} className="text-muted">Партий с заказами нет</td></tr>}</tbody></table>
        </Panel>
      </div>

      <Panel className="mt-6" title="Популярные товары">
        <table className="table-x"><thead><tr><th>Товар</th><th>Продано, шт.</th><th>Сумма</th></tr></thead>
          <tbody>{a.top.map(([n, q, s]) => <tr key={n}><td className="font-semibold">{n}</td><td>{q}</td><td>{rub(s)}</td></tr>)}
            {!a.top.length && <tr><td colSpan={3} className="text-muted">Пока нет продаж</td></tr>}</tbody></table>
      </Panel>
      <Info className="mt-6 text-[13px]">Данные считаются по заказам в системе. Возвраты после пересчёта доставки на суммы по товарам не влияют.</Info>
    </>
  );
}
