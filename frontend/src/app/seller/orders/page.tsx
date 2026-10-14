'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AdminHead, paginate, Pager, Panel } from '@/features/admin/ui';
import { sellerOrderUrl, useShopOrders } from '@/features/seller/data';
import type { PrepStatus } from '@/shared/api/types';
import { cn, rub } from '@/shared/lib/format';

const STAGES: [PrepStatus, string][] = [['new', 'Новый заказ'], ['confirmed', 'Подтверждён'], ['preparing', 'Готовится'], ['ready', 'Готов к передаче'], ['handed', 'Передан в доставку'], ['done', 'Завершён']];

export default function SellerOrders() {
  const [orders] = useShopOrders();
  const [q, setQ] = useState('');
  const [st, setSt] = useState<PrepStatus | ''>('');
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => (orders || []).filter((o) => (!st || o.prep_status === st)
    && (!q.trim() || `${o.order.code} ${o.order.recipient.name} ${o.order.items.map((i) => i.name).join(' ')}`.toLowerCase().includes(q.trim().toLowerCase()))), [orders, q, st]);
  const { rows, pages, page: cur } = paginate(filtered, page);
  const count = (s: PrepStatus) => (orders || []).filter((o) => o.prep_status === s).length;
  return (
    <>
      <AdminHead title="Заказы магазина" crumb={[['Кабинет поставщика', '/seller'], ['Заказы магазина']]} text="Только позиции вашего магазина. Контакты покупателя и оплату видит площадка." />
      <Panel>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field"><span className="label">Поиск по заказам</span><input className="input" placeholder="Номер, получатель или товар" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></label>
          <label className="field"><span className="label">Этап подготовки</span><select className="select" value={st} onChange={(e) => { setSt(e.target.value as PrepStatus | ''); setPage(1); }}><option value="">Все этапы</option>{STAGES.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
        </div>
      </Panel>
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" className={cn('pill', st && 'pill-soft')} onClick={() => setSt('')}>Все · {orders?.length ?? 0}</button>
        {STAGES.map(([k, t]) => <button key={k} type="button" className={cn('pill', st !== k && 'pill-soft')} onClick={() => { setSt(k); setPage(1); }}>{t} · {count(k)}</button>)}
      </div>
      <div className="mt-4 overflow-x-auto">
        {!orders ? <p className="text-muted">Загружаем…</p> : (
          <table className="table-x min-w-[760px]">
            <thead><tr><th>№ заказа</th><th>Дата</th><th>Состав из магазина</th><th>Товары</th><th>Получение</th><th>Этап</th><th>Действие</th></tr></thead>
            <tbody>{rows.map((o) => (
              <tr key={o.order.code}>
                <td className="font-semibold"><Link className="hover:text-accent" href={sellerOrderUrl(o.order.code)}>{o.order.code}</Link></td>
                <td className="whitespace-nowrap">{new Date(o.order.created_at).toLocaleDateString('ru-RU')}</td>
                <td>{o.order.items.map((i) => `${i.name} × ${i.qty}`).join(', ')}</td>
                <td className="whitespace-nowrap">{rub(o.order.goods_rub)}</td><td>{o.order.recipient.city}</td>
                <td>{o.order.status === 'cancelled' ? <span className="text-muted">Отменён покупателем</span> : o.prep_title}</td>
                <td><Link className="text-accent" href={sellerOrderUrl(o.order.code)}>{o.prep_status === 'new' && o.order.status !== 'cancelled' ? 'Подтвердить' : 'Подробнее'}</Link></td>
              </tr>
            ))}{!rows.length && <tr><td colSpan={7} className="text-muted">Заказов не найдено</td></tr>}</tbody>
          </table>
        )}
      </div>
      <Pager page={cur} pages={pages} total={filtered.length} shown={rows.length} onPage={setPage} />
      <Panel className="mt-6" title="Последовательность подготовки">
        <div className="flex flex-wrap gap-2">{STAGES.map(([, t], i) => <span key={t} className={cn('pill', i ? 'pill-soft' : '')}>{t}</span>)}</div>
        <p className="mt-3 text-[13px] text-muted">Откройте заказ, чтобы подтвердить наличие и отметить подготовку. Завершает заказ площадка после доставки.</p>
      </Panel>
    </>
  );
}
