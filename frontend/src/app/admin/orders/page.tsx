'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { AdminHead, ORDER_ADMIN, orderUrl, paginate, Pager, Panel, waveUrl } from '@/features/admin/ui';
import { useShop } from '@/features/shop/store';
import { get } from '@/shared/api/client';
import type { Order, OrderStatus } from '@/shared/api/types';
import { cn, rub } from '@/shared/lib/format';

const day = (iso: string) => new Date(iso).toLocaleDateString('ru-RU');
const PERIODS = [['', 'За всё время'], ['7', 'Последние 7 дней'], ['30', 'Последние 30 дней'], ['90', 'Последние 90 дней']] as const;

function OrdersAdmin() {
  const { meta } = useShop();
  const sp = useSearchParams();
  const router = useRouter();
  const wave = sp.get('wave');
  const [list, setList] = useState<Order[] | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [dir, setDir] = useState('');
  const [period, setPeriod] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => { get<Order[]>(`/api/admin/orders${wave ? `?wave=${encodeURIComponent(wave)}` : ''}`).then(setList).catch(() => setList([])); }, [wave]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const since = period ? Date.now() - Number(period) * 86400000 : 0;
    return (list || []).filter((o) => (!status || o.status === status) && (!dir || o.direction === dir)
      && (!since || new Date(o.created_at).getTime() >= since)
      && (!term || [o.code, o.customer_name, o.customer_phone, o.recipient.name, ...o.items.map((i) => i.name)].join(' ').toLowerCase().includes(term)));
  }, [list, q, status, dir, period]);
  const { rows, pages, page: cur } = paginate(filtered, page);
  const count = (s: OrderStatus) => (list || []).filter((o) => o.status === s).length;
  const reset = () => { setQ(''); setStatus(''); setDir(''); setPeriod(''); setPage(1); if (wave) router.replace('/admin/orders'); };
  const chips: [OrderStatus | '', string][] = [['', `Все · ${list?.length ?? 0}`], ...(['accepted', 'assembling', 'transit', 'pickup', 'received', 'cancelled'] as OrderStatus[]).map((s) => [s, `${ORDER_ADMIN[s]} · ${count(s)}`] as [OrderStatus, string])];

  return (
    <>
      <AdminHead title="Заказы" text="Поиск и фильтры по заказам. Карточка заказа — по номеру." />
      <Panel>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="field"><span className="label">Поиск по заказам</span><input className="input" placeholder="Номер, покупатель, товар" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></label>
          <label className="field"><span className="label">Статус</span><select className="select" value={status} onChange={(e) => { setStatus(e.target.value as OrderStatus | ''); setPage(1); }}><option value="">Все статусы</option>{(Object.keys(ORDER_ADMIN) as OrderStatus[]).map((s) => <option key={s} value={s}>{ORDER_ADMIN[s]}</option>)}</select></label>
          <label className="field"><span className="label">Направление</span><select className="select" value={dir} onChange={(e) => { setDir(e.target.value); setPage(1); }}><option value="">Все направления</option>{Object.values(meta.directions).map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}</select></label>
          <label className="field"><span className="label">Период</span><select className="select" value={period} onChange={(e) => { setPeriod(e.target.value); setPage(1); }}>{PERIODS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {wave && <span className="pill">Партия {wave}</span>}
          <button type="button" className="pill pill-soft" onClick={reset}>Сбросить фильтры</button>
        </div>
      </Panel>
      <div className="mt-5 flex flex-wrap gap-2">
        {chips.map(([s, t]) => <button key={s || 'all'} type="button" className={cn('pill', status !== s && 'pill-soft')} onClick={() => { setStatus(s); setPage(1); }}>{t}</button>)}
      </div>
      <div className="mt-4 overflow-x-auto">
        {!list ? <p className="text-muted">Загружаем…</p> : (
          <table className="table-x min-w-[920px]">
            <thead><tr><th>№</th><th>Дата</th><th>Покупатель</th><th>Отправление</th><th>Получение</th><th>Сумма</th><th>Статус</th><th>Партия</th><th>Действие</th></tr></thead>
            <tbody>{rows.map((o) => (
              <tr key={o.code}>
                <td className="font-semibold whitespace-nowrap"><Link href={orderUrl(o)} className="hover:text-accent">{o.code}</Link>{o.gift && <span className="block text-xs font-normal text-accent">подарок</span>}</td>
                <td className="whitespace-nowrap">{day(o.created_at)}</td>
                <td>{o.customer_name}<span className="block text-xs text-muted">{o.customer_phone}</span></td>
                <td>{meta.regions[meta.directions[o.direction].from].name}</td>
                <td>{o.recipient.city}</td>
                <td className="whitespace-nowrap">{rub(o.total_rub)}</td>
                <td>{ORDER_ADMIN[o.status]}</td>
                <td className="whitespace-nowrap">{o.wave ? <Link className="hover:text-accent" href={waveUrl(o.wave)}>{new Date(o.wave.departure).toLocaleDateString('ru-RU')}</Link> : '—'}</td>
                <td><Link className="text-accent" href={orderUrl(o)}>{o.status === 'received' || o.status === 'cancelled' ? 'История' : 'Подробнее'}</Link></td>
              </tr>
            ))}{!rows.length && <tr><td colSpan={9} className="text-muted">Заказов не найдено</td></tr>}</tbody>
          </table>
        )}
      </div>
      <Pager page={cur} pages={pages} total={filtered.length} shown={rows.length} onPage={setPage} />
    </>
  );
}

export default function Page() {
  return <Suspense><OrdersAdmin /></Suspense>;
}
