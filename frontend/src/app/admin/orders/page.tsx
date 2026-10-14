'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { StatusTag } from '@/features/orders/OrderCard';
import { useShop } from '@/features/shop/store';
import { get, post } from '@/shared/api/client';
import type { Order, OrderStatus } from '@/shared/api/types';
import { cn, fmtDate, kg, rub } from '@/shared/lib/format';
import { Icon, Kv } from '@/shared/ui';

function OrdersAdmin() {
  const { meta, toast } = useShop();
  const wave = useSearchParams().get('wave');
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [list, setList] = useState<Order[] | null>(null);
  const [open, setOpen] = useState<Order | null>(null);
  const load = useCallback(() => {
    const q = new URLSearchParams();
    if (status) q.set('status', status);
    if (wave) q.set('wave', wave);
    get<Order[]>(`/api/admin/orders?${q}`).then(setList);
  }, [status, wave]);
  useEffect(() => { load(); }, [load]);
  const all = [...meta.order_statuses, { id: 'cancelled' as const, title: 'Отменён' }];
  const change = async (code: string, s: OrderStatus) => {
    try { await post(`/api/admin/orders/${encodeURIComponent(code)}/status`, { status: s }); toast(`${code}: ${all.find((x) => x.id === s)?.title}`); load(); }
    catch (e) { toast((e as Error).message); }
  };
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <button className={cn('chip', !status && 'chip-on')} onClick={() => setStatus('')}>Все</button>
        {meta.order_statuses.map((s) => <button key={s.id} className={cn('chip', status === s.id && 'chip-on')} onClick={() => setStatus(s.id)}>{s.title}</button>)}
        {wave && <span className="chip chip-on">Волна {wave}</span>}
      </div>
      {!list ? <p className="text-muted">Загружаем…</p> : (
        <div className="overflow-x-auto rounded-card border border-line">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-soft text-left text-[13px]"><tr>{['№', 'Дата', 'Покупатель → получатель', 'Направление', 'Тип', 'Сумма', 'Статус'].map((h) => <th key={h} className="px-4 py-3.5 font-semibold">{h}</th>)}</tr></thead>
            <tbody>{list.length ? list.map((o) => (
              <tr key={o.code} className="border-t border-line [&>td]:px-4 [&>td]:py-3">
                <td><button className="text-accent underline-offset-2 hover:underline" onClick={() => setOpen(o)}>{o.code}</button></td>
                <td className="whitespace-nowrap">{fmtDate(o.created_at)}</td>
                <td>{o.customer_name}<div className="text-xs text-muted">→ {o.recipient.name}, {o.recipient.city}</div></td>
                <td>{o.direction_title}<div className="text-xs text-muted">отправка {o.wave ? fmtDate(o.wave.departure) : '—'}</div></td>
                <td>{o.gift ? <span className="tag"><Icon name="gift" className="size-3.5" />подарок</span> : o.kind === 'b2b' ? <span className="tag tag-muted">B2B</span> : 'для себя'}</td>
                <td className="whitespace-nowrap"><b>{rub(o.total_rub)}</b><div className="text-xs text-muted">{kg(o.weight_kg)} · дост. {rub(o.delivery_rub)}</div></td>
                <td><select className="select min-h-9 w-auto py-1.5 text-[13px]" value={o.status} onChange={(e) => change(o.code, e.target.value as OrderStatus)}>{all.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}</select></td>
              </tr>
            )) : <tr><td colSpan={7} className="px-4 py-3 text-muted">Заказов нет</td></tr>}</tbody>
          </table>
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-ink/35 p-4" onClick={(e) => e.target === e.currentTarget && setOpen(null)}>
          <div role="dialog" aria-modal="true" className="max-h-[90vh] w-full max-w-[640px] overflow-auto rounded-card bg-white p-6">
            <div className="flex items-center justify-between"><h2 className="h2">Заказ {open.code}</h2><button aria-label="Закрыть" onClick={() => setOpen(null)}><Icon name="x" /></button></div>
            <p className="mt-2 text-[13px] text-muted">{fmtDate(open.created_at, true)} · {open.direction_title} · <StatusTag o={open} /></p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 text-[13px]">
              <div><b>Покупатель</b><p>{open.customer_name}<br />{open.customer_phone}{open.company && <><br />{open.company}</>}</p></div>
              <div><b>Получатель</b><p>{open.recipient.name}<br />{open.recipient.phone}<br />{open.recipient.address}</p></div>
            </div>
            <hr className="divider" />
            {open.items.map((i) => <Kv key={i.id} k={`${i.name} × ${i.qty}`} v={rub(i.price_rub * i.qty)} />)}
            <Kv k={`Доставка ${kg(open.weight_kg)} × ${open.rate_rub} ₽`} v={rub(open.delivery_rub)} />
            {open.thermo_rub > 0 && <Kv k="Термоупаковка" v={rub(open.thermo_rub)} />}
            {open.gift_rub > 0 && <Kv k="Подарочная коробка" v={rub(open.gift_rub)} />}
            {open.receive_rub > 0 && <Kv k="Курьер" v={rub(open.receive_rub)} />}
            <Kv k={<b>Итого</b>} v={rub(open.total_rub)} />
            {open.refund_rub > 0 && <p className="mt-2 text-[13px] text-accent">К возврату после пересчёта: {rub(open.refund_rub)}</p>}
            {open.gift && <div className="mt-4 rounded-card bg-pink p-5 text-sm"><p className="whitespace-pre-wrap">{open.gift.message}</p><p className="mt-2 font-semibold">{open.gift.signature}</p>{open.gift.surprise && <p className="mt-2 text-xs text-muted">Сюрприз — связаться с отправителем</p>}</div>}
          </div>
        </div>
      )}
    </>
  );
}

export default function Page() {
  return <Suspense><OrdersAdmin /></Suspense>;
}
