// Общие блоки админ-панели (макет «Панель администратора»).
import type { ReactNode } from 'react';
import type { Order, OrderStatus, Wave, WaveStatus } from '@/shared/api/types';
import { cn, fmtDate } from '@/shared/lib/format';
import { Crumbs } from '@/shared/ui';

export function AdminHead({ title, crumb, text, children }: { title: string; crumb?: [string, string?][]; text?: string; children?: ReactNode }) {
  return (
    <div className="mb-6">
      <Crumbs items={crumb?.[0]?.[0] === 'Кабинет поставщика' ? crumb : [['Панель администратора', '/admin'], ...(crumb || [[title]])]} />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-head text-[28px] font-bold leading-tight md:text-[34px]">{title}</h1>
        {children}
      </div>
      {text && <p className="mt-3 text-[13px] text-muted">{text}</p>}
    </div>
  );
}

export function Kpi({ title, value, hint }: { title: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-card border border-line p-5">
      <span className="text-[13px] text-muted">{title}</span>
      <b className="mt-3 block font-head text-[26px]">{value}</b>
      {hint && <span className="mt-2 block text-xs text-muted">{hint}</span>}
    </div>
  );
}

/** Столбчатая диаграмма: последний столбец (или выделенный) — акцентный. */
export function Bars({ data, accent, format = String }: { data: [string, number][]; accent?: number; format?: (n: number) => string }) {
  const max = Math.max(1, ...data.map(([, v]) => v));
  const hi = accent ?? data.length - 1;
  return (
    <div className="flex h-48 items-end gap-2 sm:gap-3" role="img" aria-label={data.map(([k, v]) => `${k}: ${format(v)}`).join(', ')}>
      {data.map(([k, v], i) => (
        <div key={k} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
          <span className="text-[11px] text-muted">{format(v)}</span>
          <div className={cn('w-full rounded-t', i === hi ? 'bg-accent' : 'bg-[#ebe4e1]')} style={{ height: `${Math.max(3, (v / max) * 100)}%` }} />
          <span className="w-full truncate text-center text-[11px] text-muted">{k}</span>
        </div>
      ))}
    </div>
  );
}

export const WAVE_PILL: Record<WaveStatus, string> = {
  collecting: 'Формируется', closed: 'Готова к отправке', transit: 'В пути', arrived: 'Прибыла', done: 'Завершена', postponed: 'Перенесена',
};
export const ORDER_ADMIN: Record<OrderStatus, string> = {
  accepted: 'Ожидает объединения', assembling: 'Готовится к отправке', transit: 'В пути', pickup: 'На пункте выдачи', received: 'Получен', cancelled: 'Отменён',
};

export const waveName = (w: Pick<Wave, 'departure' | 'title'>) => `${w.title} · ${fmtDate(w.departure)}`;
export const orderUrl = (o: Pick<Order, 'code'>) => `/admin/orders/${encodeURIComponent(o.code)}`;
export const waveUrl = (w: Pick<Wave, 'id'>) => `/admin/waves/${encodeURIComponent(w.id)}`;

export function Panel({ title, children, className, soft, action }: { title?: ReactNode; children: ReactNode; className?: string; soft?: boolean; action?: ReactNode }) {
  return (
    <section className={cn('rounded-card border border-line p-5 sm:p-6', soft ? 'bg-[#faf8f7]' : 'bg-white', className)}>
      {title && <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-head text-xl font-bold">{title}</h2>{action}</div>}
      {children}
    </section>
  );
}

/** Постраничный вывод таблиц: «Показано N из M», Назад / Далее. */
export function Pager({ page, pages, total, shown, onPage }: { page: number; pages: number; total: number; shown: number; onPage: (p: number) => void }) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted">
      <span>Показано {shown} из {total}</span>
      {pages > 1 && (
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Назад</button>
          <span className="grid size-8 place-items-center rounded-full border border-accent text-accent">{page}</span>
          <button type="button" className="btn btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Далее</button>
        </div>
      )}
    </div>
  );
}

export function paginate<T>(list: T[], page: number, size = 15) {
  const pages = Math.max(1, Math.ceil(list.length / size));
  const p = Math.min(page, pages);
  return { rows: list.slice((p - 1) * size, p * size), pages, page: p };
}
