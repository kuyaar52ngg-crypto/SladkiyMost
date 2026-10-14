// Общие блоки личного кабинета (макет «Личный кабинет покупателя»).
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Order, OrderStatus, Wave } from '@/shared/api/types';
import { cn, fmtDate, fmtRange, kg, rub } from '@/shared/lib/format';
import { Icon, Photo } from '@/shared/ui';

export const ACTIVE: OrderStatus[] = ['accepted', 'assembling', 'transit', 'pickup'];

/** Формулировки статусов для покупателя. */
export const ORDER_PILL: Record<OrderStatus, string> = {
  accepted: 'Ожидает объединения', assembling: 'Готовится к отправке', transit: 'В пути',
  pickup: 'Можно получать', received: 'Получен', cancelled: 'Отменён',
};

const ORDER_HINT: Record<OrderStatus, string> = {
  accepted: 'Заказ принят. Ждём, пока наберётся сборная партия, — после закрытия приёма заказ отправится в путь.',
  assembling: 'Приём в партию закрыт: собираем и упаковываем заказы к отправке.',
  transit: 'Партия в пути. Сообщим, когда можно будет получать.',
  pickup: 'Заказ прибыл — можно получать.',
  received: 'Заказ получен. Спасибо, что выбрали «Сладкий мост»!',
  cancelled: 'Заказ отменён. Если оплата прошла, деньги вернутся на карту.',
};

export const orderHint = (o: Order) => ORDER_HINT[o.status];
export const kindTitle = (o: Order) => (o.kind === 'gift' ? 'подарок' : o.kind === 'b2b' ? 'для организации' : 'для себя');
export const units = (o: Order) => o.items.reduce((s, i) => s + i.qty, 0);

export function OrderPill({ o, soft }: { o: Pick<Order, 'status'>; soft?: boolean }) {
  const quiet = o.status === 'received' || o.status === 'cancelled';
  return <span className={cn('pill', (soft || quiet) && (quiet ? 'pill-soft' : 'pill-fill'))}>{ORDER_PILL[o.status]}</span>;
}

export function Card({ title, children, className, soft }: { title?: ReactNode; children: ReactNode; className?: string; soft?: boolean }) {
  return (
    <section className={cn('rounded-card border border-line p-6', soft ? 'bg-[#faf8f7]' : 'bg-white', className)}>
      {title && <h2 className="h3 mb-4">{title}</h2>}
      {children}
    </section>
  );
}

export function Info({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start gap-3 rounded-card bg-pink px-4 py-4 text-[15px] sm:px-5', className)}>
      <Icon name="info" className="mt-0.5 size-5 text-accent" /><div>{children}</div>
    </div>
  );
}

export function Row({ k, v }: { k: ReactNode; v: ReactNode }) {
  return <div className="flex justify-between gap-4 py-2 text-[15px]"><span className="text-muted">{k}</span><b className="text-right font-semibold">{v}</b></div>;
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-3 text-[15px]">
      <span>{label}</span>
      <button type="button" role="switch" aria-checked={on} aria-label={label} className="switch" onClick={() => onChange(!on)}><span /></button>
    </label>
  );
}

export function Items({ o }: { o: Order }) {
  return (
    <ul>
      {o.items.map((i) => (
        <li key={i.id} className="flex items-center gap-4 border-b border-line py-4 first:pt-0">
          <div className="relative size-[72px] shrink-0 overflow-hidden rounded-lg bg-soft"><Photo src={i.photo} alt="" sizes="72px" /></div>
          <div className="min-w-0">
            <b className="block font-semibold">{i.name}</b>
            <p className="mt-1 text-[13px] text-muted">{i.weight_g} г · {rub(i.price_rub)} × {i.qty} шт.</p>
            <b className="mt-1.5 block font-head text-lg">{rub(i.price_rub * i.qty)}</b>
          </div>
        </li>
      ))}
    </ul>
  );
}

const STEPS = ['Оформлен', 'Ожидает объединения', 'Готовится к отправке', 'В пути', 'Доставлен'] as const;
const STEP_OF: Record<OrderStatus, number> = { accepted: 1, assembling: 2, transit: 3, pickup: 4, received: 5, cancelled: -1 };
const EVENT_OF: Partial<Record<number, OrderStatus[]>> = { 2: ['assembling'], 3: ['transit'], 4: ['pickup', 'received'] };

/** «История заказа» / «Путь заказа»: пять этапов от оформления до получения. */
export function OrderPath({ o, note }: { o: Order; note?: string }) {
  if (o.status === 'cancelled') {
    return <p className="text-[15px] text-muted">Заказ отменён {o.history.at(-1) ? fmtDate(o.history.at(-1)!.date, true) : ''}.</p>;
  }
  const cur = STEP_OF[o.status];
  const date = (i: number) => {
    if (i === 0) return fmtDate(o.created_at, true);
    if (i === 1) return i <= cur ? (o.wave ? `сбор до ${fmtDate(o.wave.cutoff)}` : '') : '';
    const ev = [...o.history].reverse().find((h) => EVENT_OF[i]?.includes(h.status));
    if (ev) return fmtDate(ev.date, true);
    if (o.wave && i === 2) return `отправка ${fmtDate(o.wave.departure)}`;
    if (o.wave && i === 4) return `ориентир ${fmtRange(o.wave.arrival_from, o.wave.arrival_to)}`;
    return 'Дата не назначена';
  };
  return (
    <>
      <ol className="space-y-4">
        {STEPS.map((t, i) => {
          const done = i < cur || cur === 5, now = i === cur && cur < 5;
          return (
            <li key={t} className="flex gap-3">
              <span className={cn('grid size-7 shrink-0 place-items-center rounded-full text-xs', done || now ? 'bg-accent text-white' : 'bg-[#faf8f7] text-muted')}>
                {done ? <Icon name="check" className="size-3.5" /> : i + 1}
              </span>
              <div>
                <b className={cn('block text-[15px]', now ? 'font-semibold' : 'font-normal')}>{t}{now && ' · текущий этап'}</b>
                <span className="text-[13px] text-muted">{date(i)}</span>
              </div>
            </li>
          );
        })}
      </ol>
      {note && <p className="mt-4 text-[15px] text-muted">{note}</p>}
    </>
  );
}

/** Горизонтальный прогресс в списке заказов. */
export function OrderProgress({ o }: { o: Order }) {
  const cur = STEP_OF[o.status];
  const steps: [string, string][] = [
    ['Заказ принят', fmtDate(o.created_at)],
    ['Собираем отправку', o.wave ? `До ${fmtDate(o.wave.cutoff)}` : ''],
    ['Готовится к отправке', o.wave ? `Отправка ${fmtDate(o.wave.departure)}` : ''],
    ['В пути', o.wave ? `Ориентир: ${fmtDate(o.wave.arrival_from)}` : ''],
  ];
  return (
    <ol className="grid gap-4 sm:grid-cols-4">
      {steps.map(([t, s], i) => {
        const done = i < cur, now = i === cur || (i === 3 && cur >= 4);
        return (
          <li key={t} className="flex items-start gap-3 sm:block">
            <span className={cn('grid size-7 shrink-0 place-items-center rounded-full text-xs sm:mb-3', done && !now ? 'bg-accent text-white' : now ? 'bg-accent text-white' : 'bg-[#faf8f7] text-muted')}>
              {done && !now ? <Icon name="check" className="size-3.5" /> : i + 1}
            </span>
            <div><b className={cn('block text-[15px]', now ? 'font-semibold' : 'font-normal')}>{t}</b><span className="text-[13px] text-muted">{s}</span></div>
          </li>
        );
      })}
    </ol>
  );
}

/** «Сборная партия»: направление, связанные заказы, вес, сроки. */
export function WaveBlock({ wave, codes, className }: { wave: Wave | null; codes: string[]; className?: string }) {
  if (!wave) return null;
  const pill = wave.status === 'collecting' ? 'Формируется' : wave.status_title;
  return (
    <Card title="Сборная партия" className={className}>
      <span className={cn('pill', wave.status !== 'collecting' && 'pill-soft')}>{pill}</span>
      <p className="mt-4 mb-2 font-semibold">{wave.title}</p>
      <Row k="Ваши заказы в партии" v={codes.join(', ')} />
      <Row k="Товарный вес партии" v={wave.load_kg ? kg(wave.load_kg) : 'Уточняется'} />
      <Row k="Приём заказов" v={wave.open ? `до ${fmtDate(wave.cutoff)}` : 'закрыт'} />
      <Row k="Отправка и получение" v={`${fmtDate(wave.departure)} · ${fmtRange(wave.arrival_from, wave.arrival_to)}`} />
      <p className="mt-3 text-[13px] text-muted">Даты ориентировочные: партия уходит после закрытия приёма, сроки в пути зависят от перевозчика.</p>
    </Card>
  );
}

export function OrderLink({ o, children, className }: { o: Order; children: ReactNode; className?: string }) {
  return <Link className={className} href={`/account/orders/${encodeURIComponent(o.code)}`}>{children}</Link>;
}

/** Ссылка из уведомления — внутри сайта, без домена. */
export function localLink(link: string) {
  try { const u = new URL(link, 'http://x'); return u.pathname + u.search; } catch { return '/account'; }
}
