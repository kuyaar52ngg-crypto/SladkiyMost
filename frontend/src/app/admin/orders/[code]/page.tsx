'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Info, Items, OrderPath, Row, units } from '@/features/account/parts';
import { AdminHead, ORDER_ADMIN, Panel, WAVE_PILL, waveName, waveUrl } from '@/features/admin/ui';
import { useShop } from '@/features/shop/store';
import { get, post } from '@/shared/api/client';
import type { Order, OrderStatus, ShopOrder } from '@/shared/api/types';
import { cn, fmtDate, kg, rub } from '@/shared/lib/format';

const HINT: Record<OrderStatus, string> = {
  accepted: 'Заказ принят и ждёт закрытия приёма в партию.', assembling: 'Приём закрыт — заказ собирают к отправке.',
  transit: 'Партия в пути.', pickup: 'Заказ прибыл в пункт выдачи.', received: 'Заказ получен покупателем.', cancelled: 'Заказ отменён.',
};

export default function AdminOrder() {
  const code = decodeURIComponent(useParams<{ code: string }>().code);
  const { toast } = useShop();
  const [o, setO] = useState<Order | null | false>(null);
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [shops, setShops] = useState<ShopOrder[]>([]);
  const load = useCallback(() => { get<Order>(`/api/admin/orders/${encodeURIComponent(code)}`).then((x) => { setO(x); setStatus(x.status); }).catch(() => setO(false)); }, [code]);
  useEffect(load, [load]);
  useEffect(() => { get<ShopOrder[]>(`/api/admin/orders/${encodeURIComponent(code)}/shops`).then(setShops).catch(() => setShops([])); }, [code]);
  if (o === null) return <p className="text-muted">Загружаем…</p>;
  if (!o) return <><AdminHead title="Заказ не найден" crumb={[['Заказы', '/admin/orders'], [code]]} /><Link className="btn" href="/admin/orders">К заказам</Link></>;

  const save = async () => {
    if (!status || status === o.status) return;
    setBusy(true);
    try { await post(`/api/admin/orders/${encodeURIComponent(o.code)}/status`, { status, note }); toast(`${o.code}: ${ORDER_ADMIN[status]}`); setNote(''); load(); }
    catch (e) { toast((e as Error).message); }
    finally { setBusy(false); }
  };
  const r = o.recipient;
  const w = o.wave;
  return (
    <>
      <AdminHead title={`Операционная карточка · ${o.code}`} crumb={[['Заказы', '/admin/orders'], [o.code]]} />
      <div className="flex flex-wrap gap-2">
        <span className="pill">Заказ № {o.code}</span>
        <span className="pill pill-soft">{fmtDate(o.created_at, true)}</span>
        <span className="pill pill-soft">{ORDER_ADMIN[o.status]}</span>
        {o.gift && <span className="pill pill-fill">Подарок</span>}
      </div>
      <Info className="mt-5 text-[13px]">{HINT[o.status]}</Info>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Panel title={`Состав · ${units(o)} шт.`}><Items o={o} /></Panel>
          <Panel title="Получатель">
            <p className="font-semibold">{r.name}</p>
            <p className="mt-2 text-sm">{r.receive === 'courier' ? `Курьер: ${r.city}, ${r.address}` : `Пункт выдачи: ${r.address}`}</p>
            <p className="mt-2 text-sm">{r.phone}</p>
          </Panel>
          <Panel title="Покупатель">
            <p className="font-semibold">{o.customer_name}</p>
            <p className="mt-2 text-sm">{o.customer_phone}{o.company && ` · ${o.company}`}</p>
            <p className="mt-2 text-xs text-muted">{o.payment_method} · {o.kind === 'gift' ? 'подарок' : o.kind === 'b2b' ? 'для организации' : 'для себя'}</p>
          </Panel>
          {o.gift && (
            <Panel title="Открытка">
              <p className="text-sm whitespace-pre-wrap">{o.gift.message}</p>
              <p className="mt-2 text-sm font-semibold">{o.gift.signature}</p>
              {o.gift.surprise && <p className="mt-2 text-xs text-accent">Сюрприз — связаться с отправителем перед вручением</p>}
            </Panel>
          )}
        </div>
        <div className="space-y-6">
          <Panel title="Сводка заказа" soft>
            <Row k={`Товары · ${units(o)} шт.`} v={rub(o.goods_rub)} />
            <Row k="Вес с упаковкой" v={kg(o.weight_kg)} />
            <Row k={`Доставка · ${o.rate_rub} ₽/кг`} v={rub(o.delivery_rub)} />
            {o.thermo_rub > 0 && <Row k="Термоупаковка" v={rub(o.thermo_rub)} />}
            {o.receive_rub > 0 && <Row k="Курьер" v={rub(o.receive_rub)} />}
            {o.gift_rub > 0 && <Row k="Коробка и открытка" v={rub(o.gift_rub)} />}
            <div className="mt-2 border-t border-line pt-2"><Row k="Итого" v={rub(o.total_rub)} /></div>
            {o.refund_rub > 0 && <p className="mt-2 text-[13px] text-accent">К возврату после пересчёта: {rub(o.refund_rub)}</p>}
          </Panel>
          {w && (
            <Panel title="Сборная партия">
              <span className={cn('pill', w.status !== 'collecting' && 'pill-soft')}>{WAVE_PILL[w.status]}</span>
              <p className="mt-3 mb-1 font-semibold">{waveName(w)}</p>
              <Row k="Заказов в партии" v={w.orders_count} />
              <Row k="Загрузка" v={`${kg(w.load_kg)} · ${Math.round(w.fill * 100)}%`} />
              <Row k="Приём до" v={fmtDate(w.cutoff)} />
              <Link className="mt-3 inline-block text-[13px] text-accent" href={waveUrl(w)}>Открыть партию</Link>
            </Panel>
          )}
          <Panel title="История заказа"><OrderPath o={o} /></Panel>
        </div>
      </div>

      {shops.length > 0 && (
        <Panel className="mt-6" title="Поставщики и подготовка">
          <div className="overflow-x-auto"><table className="table-x min-w-[560px]">
            <thead><tr><th>Магазин</th><th>Позиции</th><th>Этап</th><th>Последняя отметка</th></tr></thead>
            <tbody>{shops.map((x) => { const h = x.prep_history.at(-1); return (
              <tr key={x.shop_id}><td className="font-semibold">{x.shop_name}</td><td>{x.order.items.map((i) => `${i.name} × ${i.qty}`).join(', ')}</td>
                <td className="text-accent">{x.prep_title}</td><td className="text-[13px]">{h ? `${new Date(h.at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}${h.note ? ` · ${h.note}` : ''}` : '—'}</td></tr>); })}</tbody>
          </table></div>
        </Panel>
      )}

      <Panel className="mt-6" title="Разрешённые действия">
        <p className="text-[13px] text-muted">Статус меняется вручную с указанием причины. Покупатель получит уведомление в кабинете и в Telegram.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-[260px_1fr]">
          <label className="field"><span className="label">Новый статус</span>
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
              {(Object.keys(ORDER_ADMIN) as OrderStatus[]).map((s) => <option key={s} value={s}>{ORDER_ADMIN[s]}</option>)}
            </select></label>
          <label className="field"><span className="label">Причина изменения</span><input className="input" placeholder="Например: проверено наличие, ожидаем закрытия партии" value={note} onChange={(e) => setNote(e.target.value)} /></label>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" className="btn btn-primary" disabled={busy || status === o.status} onClick={save}>{busy ? 'Сохраняем…' : 'Изменить статус'}</button>
          {w && <Link className="btn" href={waveUrl(w)}>Открыть партию</Link>}
        </div>
      </Panel>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <Panel title="Административная история">
          <div className="overflow-x-auto">
            <table className="table-x min-w-[420px]">
              <thead><tr><th>Дата</th><th>Статус</th><th>Основание</th></tr></thead>
              <tbody>
                {!o.history.some((h) => h.status === 'accepted') && <tr><td className="whitespace-nowrap">{fmtDate(o.created_at, true)}</td><td>Оформлен</td><td className="text-muted">Заказ покупателя</td></tr>}
                {o.history.map((h, i) => <tr key={i}><td className="whitespace-nowrap">{fmtDate(h.date, true)}</td><td>{ORDER_ADMIN[h.status]}</td><td className="text-accent">{h.note || '—'}</td></tr>)}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Проверка расчёта">
          <span className="pill pill-soft">{o.final_delivery_rub !== null ? 'Доставка пересчитана' : 'Доставка по текущей загрузке'}</span>
          <ul className="mt-4 space-y-2 text-sm">
            {o.items.map((i) => <li key={i.id}>{i.qty} × {rub(i.price_rub)} = <b>{rub(i.qty * i.price_rub)}</b> · {i.name}</li>)}
            <li className="font-semibold">Товары: {rub(o.goods_rub)}</li>
            <li>Вес: {o.items.map((i) => `${i.qty} × ${i.weight_g} г`).join(' + ')} → с упаковкой {kg(o.weight_kg)}</li>
            <li>Доставка: {kg(o.weight_kg)} × {o.rate_rub} ₽/кг = {rub(o.delivery_rub)}{o.final_delivery_rub !== null && ` → итог ${rub(o.final_delivery_rub)}`}</li>
          </ul>
        </Panel>
      </div>
    </>
  );
}
