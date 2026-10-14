import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/format';
import { Icon } from './Icon';

export { Icon };
export { Photo } from './Photo';

export function Note({ children, kind, className }: { children: ReactNode; kind?: 'warn' | 'ok'; className?: string }) {
  const tone = kind === 'warn' ? 'bg-warn/10 text-warn' : kind === 'ok' ? 'bg-ok/10 text-ok' : 'bg-pink text-accent';
  return (
    <div className={cn('flex items-start gap-3 rounded-card px-4 py-3.5 text-[13px]', tone.split(' ')[0], className)}>
      <span className={tone.split(' ')[1]}><Icon name={kind === 'ok' ? 'check' : kind === 'warn' ? 'thermo' : 'info'} className="mt-px size-[18px]" /></span>
      <div className="text-ink">{children}</div>
    </div>
  );
}

export function Crumbs({ items }: { items: [string, string?][] }) {
  return (
    <nav aria-label="Хлебные крошки" className="mb-4 text-[13px] text-muted">
      {items.map(([t, href], i) => (
        <span key={i}>{i > 0 && ' / '}{href ? <Link className="hover:text-accent" href={href}>{t}</Link> : t}</span>
      ))}
    </nav>
  );
}

export function PageHead({ title, text }: { title: string; text?: string }) {
  return (
    <div className="mb-7">
      <h1 className="h1">{title}</h1>
      {text && <p className="mt-3 text-base text-muted">{text}</p>}
    </div>
  );
}

/** Шкала заполнения партии: текущая загрузка + доля заказа, отметки 50 % и 80 %. */
export function FillBar({ load, add = 0, max }: { load: number; add?: number; max: number }) {
  const cur = Math.min(100, (load / max) * 100);
  const plus = Math.min(100 - cur, (add / max) * 100);
  return (
    <div className="relative mt-3.5 h-2.5 overflow-hidden rounded-full bg-soft" role="img" aria-label={`Заполнено ${Math.round(cur)}%`}>
      <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${cur}%` }} />
      {add > 0 && <div className="absolute inset-y-0 bg-[repeating-linear-gradient(45deg,rgb(173_58_76/.5)_0_4px,rgb(173_58_76/.25)_4px_8px)]" style={{ left: `${cur}%`, width: `${plus}%` }} />}
      <div className="absolute -inset-y-0.5 left-1/2 w-0.5 bg-white" />
      <div className="absolute -inset-y-0.5 left-[80%] w-0.5 bg-white" />
    </div>
  );
}

export function Steps({ current }: { current: number }) {
  const names = ['Корзина', 'Отправка', 'Расчёт доставки', 'Оформление'];
  return (
    <ol className="mb-8 flex gap-3 md:grid md:grid-cols-4">
      {names.map((n, i) => {
        const done = i + 1 < current, cur = i + 1 === current;
        return (
          <li key={n} className={cn('flex items-center gap-2.5 text-[13px]', cur ? 'font-semibold text-accent max-md:flex-1' : 'text-muted')}>
            <span className={cn('grid size-[26px] shrink-0 place-items-center rounded-full text-xs', done || cur ? 'bg-accent text-white' : 'bg-soft')}>
              {done ? <Icon name="check" className="size-3.5" /> : i + 1}
            </span>
            <span className={cn(!cur && 'max-md:hidden')}>{n}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function Empty({ title, text, children }: { title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="card-soft px-4 py-14 text-center">
      <h3 className="h3 mb-2.5">{title}</h3>
      {text && <p className="text-muted">{text}</p>}
      {children && <div className="mt-6 flex flex-wrap justify-center gap-3">{children}</div>}
    </div>
  );
}

export function Kv({ k, v }: { k: ReactNode; v: ReactNode }) {
  return <div className="kv"><span>{k}</span><b>{v}</b></div>;
}

export function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 font-semibold">
      <span>{label}</span><b className="font-head text-[26px]">{value}</b>
    </div>
  );
}

/** Оценка звёздами; с onChange — выбор оценки. */
export function Stars({ value, onChange, size = 'text-base' }: { value: number; onChange?: (v: number) => void; size?: string }) {
  const label = `Оценка ${value} из 5`;
  if (!onChange) return <span role="img" aria-label={label} className={`${size} tracking-[2px] text-accent`}>{'★'.repeat(Math.round(value))}<span className="text-line-strong">{'★'.repeat(5 - Math.round(value))}</span></span>;
  return (
    <span role="radiogroup" aria-label="Оценка" className={`${size} inline-flex gap-1`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} из 5`} onClick={() => onChange(n)}
          className={n <= value ? 'text-accent' : 'text-line-strong hover:text-accent/60'}>★</button>
      ))}
    </span>
  );
}
