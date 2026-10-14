'use client';
import { useEffect, useState } from 'react';
import { useShop } from '@/features/shop/store';
import { get } from '@/shared/api/client';
import type { Stats } from '@/shared/api/types';
import { fmtDate, kg, rub } from '@/shared/lib/format';
import { FillBar } from '@/shared/ui';

export default function Dashboard() {
  const { meta } = useShop();
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => { get<Stats>('/api/admin/stats').then(setS); }, []);
  if (!s) return <p className="text-muted">Загружаем…</p>;
  const p = meta.policy;
  const maxTop = Math.max(1, ...s.top.map((t) => t.qty));
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[['Заказов', String(s.orders)], ['Оборот', rub(s.revenue)], ['Средний чек', rub(s.avg_check)], ['Комиссия платформы (15%)', rub(s.commission)]].map(([t, v]) => <div key={t} className="card"><span className="text-[13px] text-muted">{t}</span><b className="mt-1.5 block font-head text-[26px]">{v}</b></div>)}
      </div>
      <h2 className="h2 mt-8 mb-4">Встречная загрузка</h2>
      <div className="grid gap-4 md:grid-cols-2">{s.counter.map((c) => {
        const w = c.wave;
        return (
          <div key={c.direction} className="card">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="h3">{c.title}</h3>{w && <span className="tag">отправка {fmtDate(w.departure)}</span>}</div>
            {w ? <>
              <FillBar load={w.load_kg} max={p.max_load_kg} />
              <div className="mt-1.5 flex justify-between text-xs text-muted"><span>{kg(w.load_kg)} из {p.max_load_kg} · заказов: {w.orders_count}</span><span>тариф {w.rate} ₽/кг</span></div>
              <p className="mt-3 text-[13px]">Сбор до {fmtDate(w.cutoff)} · {w.load_kg >= p.min_load_kg ? <span className="tag tag-ok">минимум набран</span> : <span className="tag tag-warn">до минимума {kg(p.min_load_kg - w.load_kg)}</span>}</p>
            </> : <p className="text-muted">Нет открытой волны</p>}
            {c.forecast_kg !== null && <p className="mt-2 text-[13px] text-muted">Прогноз объёма волны по последним партиям: ~{c.forecast_kg} кг ({Math.round((c.forecast_kg / p.max_load_kg) * 100)}%)</p>}
          </div>
        );
      })}</div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="card"><h3 className="h3 mb-4">Популярные товары</h3>{s.top.length ? s.top.map((t) => (
          <div key={t.id} className="grid grid-cols-[1fr_2fr_auto] items-center gap-3 py-1.5 text-sm"><span>{t.name}</span><div className="h-2 overflow-hidden rounded-full bg-soft"><i className="block h-full bg-accent" style={{ width: `${(t.qty / maxTop) * 100}%` }} /></div><b>{t.qty} шт.</b></div>
        )) : <p className="text-muted">Пока нет продаж</p>}</div>
        <div className="card"><h3 className="h3 mb-4">Статусы заказов</h3>
          {[...meta.order_statuses, { id: 'cancelled' as const, title: 'Отменён' }].map((st) => <div key={st.id} className="kv"><span>{st.title}</span><b>{s.by_status[st.id] || 0}</b></div>)}
          <div className="kv"><span>Из них подарков</span><b>{s.gifts}</b></div></div>
      </div>
    </>
  );
}
