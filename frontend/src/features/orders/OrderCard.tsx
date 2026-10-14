import Image from 'next/image';
import Link from 'next/link';
import type { Order } from '@/shared/api/types';
import { cn, fmtDate, fmtRange, rub } from '@/shared/lib/format';
import { Icon, Note } from '@/shared/ui';

const FLOW = [['accepted', 'Принят'], ['assembling', 'В сборке'], ['transit', 'В пути'], ['pickup', 'На пункте выдачи'], ['received', 'Получен']] as const;

export function StatusTag({ o }: { o: Pick<Order, 'status' | 'status_title'> }) {
  const tone = { received: 'tag-ok', pickup: 'tag-ok', cancelled: 'tag-muted', accepted: 'tag-warn', assembling: 'tag-warn', transit: '' }[o.status];
  return <span className={cn('tag', tone)}>{o.status_title}</span>;
}

/** Трекинг: принят → в сборке → в пути → на пункте выдачи → получен. */
export function Track({ o }: { o: Order }) {
  if (o.status === 'cancelled') return <Note className="my-4">Заказ отменён. Деньги возвращены (имитация).</Note>;
  const idx = FLOW.findIndex(([s]) => s === o.status);
  const w = o.wave;
  const hint: Record<string, string> = w ? { accepted: `сбор до ${fmtDate(w.cutoff)}`, assembling: `отправка ${fmtDate(w.departure)}`, transit: `в пути с ${fmtDate(w.departure)}`, pickup: `ориентир ${fmtRange(w.arrival_from, w.arrival_to)}`, received: '' } : {};
  return (
    <ol className="my-4 grid gap-0 sm:grid-cols-5 sm:gap-2">
      {FLOW.map(([s, t], i) => {
        const ev = [...o.history].reverse().find((h) => h.status === s);
        const done = i < idx, cur = i === idx;
        return (
          <li key={s} className="relative grid grid-cols-[28px_1fr] gap-x-3 pb-3.5 text-[13px] sm:block sm:pb-0">
            {i < FLOW.length - 1 && <span className={cn('absolute bg-soft max-sm:top-7 max-sm:bottom-0 max-sm:left-[13px] max-sm:w-0.5 sm:top-[13px] sm:right-[-8px] sm:left-7 sm:h-0.5', done && 'bg-accent')} />}
            <span className={cn('relative z-10 grid size-7 place-items-center rounded-full text-xs sm:mb-2', done || cur ? 'bg-accent text-white' : 'bg-soft text-muted')}>{done ? <Icon name="check" className="size-3.5" /> : i + 1}</span>
            <div><b className={cn('block font-semibold', cur && 'text-accent')}>{t}</b><span className="text-xs text-muted">{ev ? fmtDate(ev.date) : hint[s]}</span></div>
          </li>
        );
      })}
    </ol>
  );
}

export function OrderCard({ o, compact = true }: { o: Order; compact?: boolean }) {
  return (
    <article className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="h3">Заказ № {o.code}</h3><p className="mt-2 text-[13px] text-muted">{fmtDate(o.created_at, true)} · {o.kind === 'gift' ? 'подарок' : o.kind === 'b2b' ? 'для организации' : 'для себя'} · {o.direction_title}</p></div>
        <StatusTag o={o} />
      </div>
      <Track o={o} />
      {o.items.map((i) => (
        <div key={i.id} className="grid grid-cols-[56px_1fr_auto] items-center gap-3.5 border-b border-line py-2.5">
          <div className="relative h-[52px] overflow-hidden rounded-lg"><Image src={i.photo} alt="" fill sizes="56px" className="object-cover" /></div>
          <div><b className="text-[13px]">{i.name}</b><p className="text-xs text-muted">{i.weight_g} г · {i.qty} шт.</p></div>
          <b className="text-[13px]">{rub(i.price_rub * i.qty)}</b>
        </div>
      ))}
      <p className="mt-3 text-[13px]">{o.recipient.name} · {o.recipient.address}</p>
      {o.wave && <p className="mt-2 text-xs text-muted">Волна: сбор до {fmtDate(o.wave.cutoff)} · отправка {fmtDate(o.wave.departure)} · получение {fmtRange(o.wave.arrival_from, o.wave.arrival_to)}, ориентировочно</p>}
      {compact && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div><b className="text-xl font-semibold">{rub(o.total_rub)}</b><p className="text-xs text-muted">включая доставку {rub(o.delivery_rub)}{o.refund_rub > 0 && ` · вернём ${rub(o.refund_rub)}`}</p></div>
          <Link className="btn" href={`/orders/${encodeURIComponent(o.code)}`}>Подробнее</Link>
        </div>
      )}
    </article>
  );
}
