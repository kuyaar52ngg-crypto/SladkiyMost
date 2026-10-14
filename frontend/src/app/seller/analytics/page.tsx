'use client';
import { useMemo, useState } from 'react';
import { Info } from '@/features/account/parts';
import { AdminHead, Bars, Kpi, Panel } from '@/features/admin/ui';
import { useShopOrders } from '@/features/seller/data';
import { useShop } from '@/features/shop/store';
import type { PrepStatus } from '@/shared/api/types';
import { rub } from '@/shared/lib/format';

const PERIODS = [['30', 'Последние 30 дней'], ['7', 'Последние 7 дней'], ['90', 'Последние 90 дней'], ['', 'За всё время']] as const;
const STAGES: [PrepStatus, string][] = [['new', 'Новый заказ'], ['confirmed', 'Подтверждён'], ['preparing', 'Готовится'], ['ready', 'Готов к передаче'], ['handed', 'Передан в доставку'], ['done', 'Завершён']];

export default function SellerAnalytics() {
  const { meta } = useShop();
  const [orders] = useShopOrders();
  const [period, setPeriod] = useState('30');
  const a = useMemo(() => {
    const since = period ? Date.now() - Number(period) * 86400000 : 0;
    const all = (orders || []).filter((o) => !since || new Date(o.order.created_at).getTime() >= since);
    const live = all.filter((o) => o.order.status !== 'cancelled');
    const goods = live.reduce((s, o) => s + o.order.goods_rub, 0);
    const prod = new Map<string, [string, number, number]>(), reg = new Map<string, [number, number]>();
    live.forEach((o) => {
      const r = reg.get(o.order.recipient.region) || [0, 0];
      reg.set(o.order.recipient.region, [r[0] + 1, r[1] + o.order.goods_rub]);
      o.order.items.forEach((i) => { const t = prod.get(i.id) || [i.name, 0, 0]; prod.set(i.id, [i.name, t[1] + i.qty, t[2] + i.qty * i.price_rub]); });
    });
    const days: [string, number][] = [];
    const span = Number(period || 90), step = Math.max(1, Math.round(span / 6));
    for (let k = 5; k >= 0; k--) {
      const to = Date.now() - k * step * 86400000, from = to - step * 86400000;
      days.push([new Date(to).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }), Math.round(live.filter((o) => { const t = new Date(o.order.created_at).getTime(); return t > from && t <= to; }).reduce((s, o) => s + o.order.goods_rub, 0) / 100) / 10]);
    }
    return { all, live, goods, prod: [...prod.values()].sort((x, y) => y[1] - x[1]), reg: [...reg], days };
  }, [orders, period]);
  if (!orders) return <p className="text-muted">Загружаем…</p>;
  const units = a.live.reduce((s, o) => s + o.order.items.reduce((x, i) => x + i.qty, 0), 0);
  return (
    <>
      <AdminHead title="Аналитика магазина" crumb={[['Кабинет поставщика', '/seller'], ['Аналитика']]} text="Только ваши позиции, без доставки. Отменённые заказы не учитываются." />
      <label className="field max-w-[360px]"><span className="label">Период</span><select className="select" value={period} onChange={(e) => setPeriod(e.target.value)}>{PERIODS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Kpi title="Сумма за товары" value={rub(a.goods)} hint="Ваши позиции в заказах" />
        <Kpi title="Заказы" value={a.live.length} hint={`${a.all.length - a.live.length} отменено`} />
        <Kpi title="Средний чек" value={rub(a.live.length ? a.goods / a.live.length : 0)} hint="По позициям магазина" />
        <Kpi title="Единиц продано" value={units} hint={`${a.prod.length} разных товаров`} />
      </div>
      <Panel className="mt-6" title="Сумма оформленных заказов за товары"><span className="pill">тыс. ₽</span><div className="mt-5"><Bars data={a.days} /></div></Panel>
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <Panel title="Популярные товары">
          <table className="table-x"><thead><tr><th>Товар</th><th>Шт.</th><th>Сумма</th><th>Доля</th></tr></thead>
            <tbody>{a.prod.map(([n, q, s]) => <tr key={n}><td className="font-semibold">{n}</td><td>{q}</td><td>{rub(s)}</td><td className="text-accent">{a.goods ? `${Math.round((s / a.goods) * 100)}%` : '—'}</td></tr>)}
              {!a.prod.length && <tr><td colSpan={4} className="text-muted">Нет продаж за период</td></tr>}</tbody></table>
        </Panel>
        <Panel title="Регионы получения">
          <table className="table-x"><thead><tr><th>Регион</th><th>Заказы</th><th>Сумма</th></tr></thead>
            <tbody>{a.reg.map(([r, [n, s]]) => <tr key={r}><td className="font-semibold">{meta.regions[r as 'YKT' | 'DNR'].name}</td><td>{n}</td><td className="text-accent">{rub(s)}</td></tr>)}
              {!a.reg.length && <tr><td colSpan={3} className="text-muted">Нет данных</td></tr>}</tbody></table>
        </Panel>
      </div>
      <Panel className="mt-6" title="Заказы по этапам">
        <table className="table-x"><thead><tr><th>Этап</th><th>Количество</th></tr></thead>
          <tbody>{STAGES.map(([k, t]) => <tr key={k}><td>{t}</td><td>{a.live.filter((o) => o.prep_status === k).length}</td></tr>)}
            <tr><td>Отменён</td><td>{a.all.length - a.live.length}</td></tr></tbody></table>
      </Panel>
      <Info className="mt-6 text-[13px]">Выплаты и комиссия площадки рассчитываются по договору и в кабинете не показываются.</Info>
    </>
  );
}
