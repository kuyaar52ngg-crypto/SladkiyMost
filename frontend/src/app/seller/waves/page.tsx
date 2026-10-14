'use client';
import Link from 'next/link';
import { AdminHead, Panel, WAVE_PILL } from '@/features/admin/ui';
import { sellerOrderUrl, useShopOrders, useShopWaves } from '@/features/seller/data';
import { Info } from '@/features/account/parts';
import { cn, fmtDate, fmtRange, kg } from '@/shared/lib/format';

export default function SellerWaves() {
  const [waves] = useShopWaves();
  const [orders] = useShopOrders();
  if (!waves || !orders) return <p className="text-muted">Загружаем…</p>;
  const of = (id: string) => orders.filter((o) => o.order.wave?.id === id && o.order.status !== 'cancelled');
  const list = [...waves].sort((a, b) => b.departure.localeCompare(a.departure));
  const focus = list.find((w) => w.status === 'collecting') || list[0];
  return (
    <>
      <AdminHead title="Сборные партии" crumb={[['Кабинет поставщика', '/seller'], ['Сборные партии']]} text="Партии, в которые попали заказы вашего магазина." />
      <div className="overflow-x-auto">
        <table className="table-x min-w-[760px]">
          <thead><tr><th>Отправка</th><th>Направление</th><th>Ваши заказы</th><th>Загрузка партии</th><th>Приём до</th><th>Получение</th><th>Статус</th></tr></thead>
          <tbody>{list.map((w) => (
            <tr key={w.id} className={cn(w === focus && 'bg-pink/60')}>
              <td className="font-semibold">{fmtDate(w.departure)}</td><td>{w.title}</td>
              <td>{of(w.id).map((o) => <Link key={o.order.code} className="mr-2 text-accent" href={sellerOrderUrl(o.order.code)}>{o.order.code}</Link>)}</td>
              <td>{kg(w.load_kg)}</td><td>{fmtDate(w.cutoff)}</td><td className="whitespace-nowrap">{fmtRange(w.arrival_from, w.arrival_to)}</td><td>{WAVE_PILL[w.status]}</td>
            </tr>
          ))}{!list.length && <tr><td colSpan={7} className="text-muted">Ваших заказов в партиях пока нет</td></tr>}</tbody>
        </table>
      </div>
      {focus && (
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
          <Panel title={`Партия · ${fmtDate(focus.departure)}`}>
            <span className={cn('pill', focus.status !== 'collecting' && 'pill-soft')}>{WAVE_PILL[focus.status]}</span>
            <p className="mt-3 font-semibold">{focus.title}</p>
            <p className="mt-2 text-sm">Ваших заказов: {of(focus.id).length} · всего в партии: {focus.orders_count}</p>
            <p className="mt-2 text-sm">Приём до {fmtDate(focus.cutoff)} · отправка {fmtDate(focus.departure)}</p>
          </Panel>
          <Panel title="Заказы магазина в партии">
            <ul className="space-y-2 text-sm">{of(focus.id).map((o) => <li key={o.order.code} className="flex justify-between gap-3"><Link className="font-semibold hover:text-accent" href={sellerOrderUrl(o.order.code)}>{o.order.code}</Link><span>{o.prep_title}</span></li>)}</ul>
            <Link className="btn btn-primary mt-5" href="/seller/orders">Открыть заказы</Link>
          </Panel>
        </div>
      )}
      <Info className="mt-6 text-[13px]">Поставщик не объединяет заказы: дату передачи и отправку согласует площадка. Подготовьте позиции к закрытию приёма в партию.</Info>
    </>
  );
}
