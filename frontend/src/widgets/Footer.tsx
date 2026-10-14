import Link from 'next/link';
import { getMeta } from '@/shared/api/meta';
import { Logo } from './Logo';

const COLS: [string, [string, string][]][] = [
  ['Выбрать сладости', [['/catalog?region=YKT', 'Сладости Якутии'], ['/catalog?region=DNR', 'Сладости Донбасса'], ['/catalog?category=Подарочные наборы', 'Подарочные наборы']]],
  ['Покупателю', [['/delivery', 'Как работает доставка'], ['/delivery#rules', 'Оплата и получение'], ['/account/orders', 'Мои заказы']]],
  ['Будем на связи', [['/account/support', 'Задать вопрос'], ['/seller/login', 'Кабинет поставщика'], ['/about', 'О нас']]],
];

const tgUrl = (t: string) => (t.startsWith('@') ? `https://t.me/${t.slice(1)}` : t);

export async function Footer() {
  const meta = await getMeta().catch(() => null);
  const c = meta?.content;
  const contacts = c ? ([
    c.contacts.phone && ['tel', c.contacts.phone, `tel:${c.contacts.phone.replace(/[^\d+]/g, '')}`],
    c.contacts.email && ['mail', c.contacts.email, `mailto:${c.contacts.email}`],
    c.contacts.telegram && ['tg', c.contacts.telegram, tgUrl(c.contacts.telegram)],
  ].filter(Boolean) as [string, string, string][]) : [];
  return (
    <footer className="bg-[#faf8f7] pt-12 pb-6">
      <div className="container-x">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="sm:col-span-2 lg:col-span-1"><Logo align="start" /><p className="mt-3 text-[13px] text-muted">{c?.footer.tagline || 'Сладости, которые делают расстояния меньше.'}</p>
            {contacts.length > 0 && <ul className="mt-3 space-y-1 text-[13px]">{contacts.map(([k, t, href]) => <li key={k}><a className="hover:text-accent" href={href} {...(k === 'tg' ? { target: '_blank', rel: 'noreferrer' } : {})}>{t}</a></li>)}</ul>}
            {c?.contacts.hours && <p className="mt-1 text-xs text-muted">{c.contacts.hours}</p>}</div>
          {COLS.map(([h, links]) => (
            <div key={h}>
              <h4 className="mb-3 font-sans text-sm font-semibold">{h}</h4>
              <ul className="space-y-2 text-[13px] text-muted">{links.map(([href, t]) => <li key={t}><Link className="hover:text-accent" href={href}>{t}</Link></li>)}</ul>
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap justify-between gap-4 border-t border-line pt-5 text-xs text-muted">
          <span>© 2026 «Сладкий мост»</span><Link className="hover:text-accent" href="/about#privacy">Политика конфиденциальности</Link><Link className="hover:text-accent" href="/delivery#rules">Условия заказа</Link>
        </div>
      </div>
    </footer>
  );
}
