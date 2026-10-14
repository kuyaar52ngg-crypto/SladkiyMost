'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Info, Items, OrderPath, Row } from '@/features/account/parts';
import { AdminHead, Panel, WAVE_PILL } from '@/features/admin/ui';
import { PREP_NEXT } from '@/features/seller/context';
import { units } from '@/features/seller/data';
import { useShop } from '@/features/shop/store';
import { get, post } from '@/shared/api/client';
import type { ShopOrder } from '@/shared/api/types';
import { cn, fmtDate, kg, rub } from '@/shared/lib/format';
import { Icon } from '@/shared/ui';

const STAGES = ['Новый заказ', 'Подтверждён', 'Готовится', 'Готов к передаче', 'Передан в доставку', 'Завершён'];
const ORDER = ['new', 'confirmed', 'preparing', 'ready', 'handed', 'done'];

export default function SellerOrder() {
  const code = decodeURIComponent(useParams<{ code: string }>().code);
  const { toast } = useShop();
  const [v, setV] = useState<ShopOrder | null | false>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { get<ShopOrder>(`/api/seller/orders/${encodeURIComponent(code)}`).then(setV).catch(() => setV(false)); }, [code]);
  useEffect(load, [load]);
  if (v === null) return <p className="text-muted">Загружаем…</p>;
  if (!v) return <><AdminHead title="Заказ не найден" crumb={[['Кабинет поставщика', '/seller'], ['Заказы', '/seller/orders'], [code]]} /><Link className="btn" href="/seller/orders">К заказам</Link></>;
  const o = v.order;
  const next = o.status !== 'cancelled' ? PREP_NEXT[v.prep_status] : undefined;
  const stage = ORDER.indexOf(v.prep_status);
  const act = async () => {
    if (!next) return;
    setBusy(true);
    try { await post(`/api/seller/orders/${encodeURIComponent(o.code)}/prep`, { status: next[0], note }); toast(next[1]); setNote(''); load(); }
    catch (e) { toast((e as Error).message); }
    finally { setBusy(false); }
  };
  const at = (s: string) => v.prep_history.filter((h) => h.status === s).at(-1);
  return (
    <>
      <AdminHead title={`Заказ № ${o.code}`} crumb={[['Кабинет поставщика', '/seller'], ['Заказы', '/seller/orders'], [o.code]]} />
      <div className="flex flex-wrap gap-2"><span className="pill">Заказ № {o.code}</span><span className="pill pill-soft">{fmtDate(o.created_at, true)}</span><span className="pill pill-soft">{o.status === 'cancelled' ? 'Отменён' : v.prep_title}</span></div>
      <Info className="mt-5 text-[13px]">{o.status === 'cancelled' ? 'Покупатель отменил заказ — готовить его не нужно.' : v.prep_status === 'new' ? 'Новый заказ: проверьте наличие и подтвердите его.' : 'Отмечайте этапы подготовки — площадка видит их и планирует передачу в сборную партию.'}</Info>
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Panel title={`Состав · ${units(v)} шт.`}><Items o={o} /></Panel>
          <Panel title="Получатель">
            <p className="font-semibold">{o.recipient.name}</p>
            <p className="mt-2 text-sm">{o.recipient.city} · {o.recipient.receive === 'courier' ? 'курьер до адреса' : 'пункт выдачи'}</p>
            <p className="mt-2 text-xs text-muted">Контакты получателя и доставку согласует площадка.</p>
          </Panel>
          {o.gift && <Panel title="Подарок"><p className="text-sm">Нужна подарочная упаковка. Открытку вложит площадка при сборке партии.</p></Panel>}
        </div>
        <div className="space-y-6">
          <Panel title="Сводка" soft>
            <Row k={`Товары · ${units(v)} шт.`} v={rub(o.goods_rub)} />
            <Row k="Вес товаров" v={kg(o.weight_kg)} />
            <Row k="Термочувствительные" v={o.items.some((i) => i.temp_sensitive) ? 'да — термоупаковка' : 'нет'} />
          </Panel>
          {o.wave && (
            <Panel title="Сборная партия">
              <span className={cn('pill', o.wave.status !== 'collecting' && 'pill-soft')}>{WAVE_PILL[o.wave.status]}</span>
              <p className="mt-3 font-semibold">{o.wave.title}</p>
              <Row k="Приём заказов" v={`до ${fmtDate(o.wave.cutoff)}`} />
              <Row k="Отправка" v={fmtDate(o.wave.departure)} />
            </Panel>
          )}
          <Panel title="История заказа"><OrderPath o={o} /></Panel>
        </div>
      </div>
      {next && (
        <Panel className="mt-6" title="Разрешённые действия">
          <p className="text-[13px] text-muted">Поставщик отмечает подготовку своих позиций. Объединение в партии и доставку ведёт администратор.</p>
          <label className="field mt-4"><span className="label">Комментарий для площадки</span><input className="input" placeholder="Например: всё в наличии, упакуем к пятнице" value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={act}>{busy ? 'Сохраняем…' : next[1]}</button>
            <Link className="btn" href="/seller/orders">К заказам</Link>
          </div>
        </Panel>
      )}
      <Panel className="mt-6" title="История подготовки в магазине">
        <ol className="space-y-4">
          {STAGES.map((t, i) => {
            const done = i < stage || (i === stage && i === 5), now = i === stage && i < 5, h = at(ORDER[i]);
            return (
              <li key={t} className="flex gap-3">
                <span className={cn('grid size-7 shrink-0 place-items-center rounded-full text-xs', done || now ? 'bg-accent text-white' : 'bg-[#faf8f7] text-muted')}>{done ? <Icon name="check" className="size-3.5" /> : i + 1}</span>
                <div><b className={cn('block text-sm', now ? 'font-semibold' : 'font-normal')}>{t}{now && ' · текущий этап'}</b>
                  <span className="text-xs text-muted">{h ? `${new Date(h.at).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}${h.note ? ` · ${h.note}` : ''}` : 'Дата не назначена'}</span></div>
              </li>
            );
          })}
        </ol>
      </Panel>
    </>
  );
}
