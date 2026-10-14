'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useOrders } from '@/features/account/data';
import { AccountHead } from '@/features/account/page';
import { ACTIVE, Info, Items, kindTitle, OrderPill, OrderProgress, orderHint } from '@/features/account/parts';
import { useShop } from '@/features/shop/store';
import type { Order } from '@/shared/api/types';
import { cn, fmtDate, fmtRange, rub } from '@/shared/lib/format';

function Head({ o, big }: { o: Order; big?: boolean }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <Link href={`/account/orders/${encodeURIComponent(o.code)}`} className={cn('hover:text-accent', big ? 'font-head text-2xl font-bold' : 'text-lg font-semibold')}>Заказ № {o.code}</Link>
        <p className="mt-1.5 text-[13px] text-muted">{fmtDate(o.created_at, true)} · {kindTitle(o)}</p>
      </div>
      <OrderPill o={o} soft />
    </div>
  );
}

/** Активный заказ — подробно: этапы, состав, партия. */
function ActiveCard({ o }: { o: Order }) {
  const w = o.wave;
  return (
    <article className="rounded-card border border-line p-6 sm:p-7">
      <Head o={o} big />
      <Info className="my-6">{orderHint(o)}</Info>
      <OrderProgress o={o} />
      <div className="mt-6"><Items o={o} /></div>
      <p className="mt-4 text-[15px]">{o.direction_title} · {o.recipient.receive === 'courier' ? 'курьером до адреса' : 'в пункт выдачи'}</p>
      {w && <p className="mt-2 text-[13px] text-muted">Сбор до {fmtDate(w.cutoff)} · отправка {fmtDate(w.departure)} · получение {fmtRange(w.arrival_from, w.arrival_to)}, ориентировочно</p>}
      <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <div><b className="font-head text-[26px]">{rub(o.total_rub)}</b><p className="mt-1 text-[13px] text-muted">включая доставку {rub(o.delivery_rub)}</p></div>
        <div className="flex flex-wrap gap-3">
          <Link className="btn" href={`/account/support?order=${encodeURIComponent(o.code)}`}>Задать вопрос о заказе</Link>
          <Link className="btn" href={`/account/orders/${encodeURIComponent(o.code)}`}>Подробнее</Link>
        </div>
      </div>
    </article>
  );
}

/** Остальные заказы — кратко. */
function ShortCard({ o }: { o: Order }) {
  const { add } = useShop();
  const router = useRouter();
  const repeat = () => { o.items.forEach((i) => add(i, i.qty)); router.push('/cart'); };
  return (
    <article className="rounded-card border border-line p-6">
      <Head o={o} />
      <p className="mt-4 text-[15px] text-muted">{o.items.map((i) => `${i.name} × ${i.qty}`).join(', ')}. {o.direction_title}.</p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <b className="font-head text-[22px]">{o.status === 'cancelled' ? `${rub(o.goods_rub)} за товары` : rub(o.total_rub)}</b>
        {o.status === 'cancelled'
          ? <Link className="btn" href="/catalog">Выбрать сладости</Link>
          : o.status === 'received' ? <button type="button" className="btn" onClick={repeat}>Повторить заказ</button>
            : <Link className="btn" href={`/account/orders/${encodeURIComponent(o.code)}`}>Подробнее</Link>}
      </div>
    </article>
  );
}

export default function AccountOrders() {
  const [orders] = useOrders();
  const [f, setF] = useState<'all' | 'active' | 'done'>('all');
  const list = orders || [];
  const shown = list.filter((o) => f === 'all' || (f === 'active') === ACTIVE.includes(o.status));
  const chips: [typeof f, string, number][] = [
    ['all', 'Все', list.length], ['active', 'Активные', list.filter((o) => ACTIVE.includes(o.status)).length],
    ['done', 'Завершённые', list.filter((o) => !ACTIVE.includes(o.status)).length],
  ];
  const firstActive = shown.find((o) => ACTIVE.includes(o.status));
  return (
    <>
      <AccountHead title="Мои заказы" text="Ваши сладости в пути — все детали и статусы в одном месте." />
      <div className="mb-5 flex flex-wrap gap-2">
        {chips.map(([k, t, n]) => <button key={k} type="button" className={cn('pill', f !== k && 'pill-soft')} onClick={() => setF(k)}>{t} · {n}</button>)}
      </div>
      {!orders ? <p className="text-muted">Загружаем…</p> : shown.length ? (
        <div className="space-y-6">{shown.map((o) => (o === firstActive ? <ActiveCard key={o.code} o={o} /> : <ShortCard key={o.code} o={o} />))}</div>
      ) : (
        <div className="rounded-card border border-line px-6 py-14 text-center">
          <h2 className="h3">Заказов пока нет</h2>
          <p className="mt-3 text-muted">Здесь появятся заказы, оформленные из этого аккаунта.</p>
          <Link className="btn btn-primary mt-6" href="/catalog">Выбрать сладости</Link>
        </div>
      )}
    </>
  );
}
