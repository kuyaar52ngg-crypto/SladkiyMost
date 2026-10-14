import Link from 'next/link';
import { Logo } from './Logo';

const COLS: [string, [string, string][]][] = [
  ['Выбрать сладости', [['/catalog?region=YKT', 'Сладости Якутии'], ['/catalog?region=DNR', 'Сладости Донбасса'], ['/catalog?category=Подарочные наборы', 'Подарочные наборы']]],
  ['Покупателю', [['/delivery', 'Как работает доставка'], ['/delivery#rules', 'Оплата и получение'], ['/account/orders', 'Мои заказы']]],
  ['Будем на связи', [['/account/support', 'Задать вопрос'], ['/seller/login', 'Кабинет поставщика'], ['/about', 'О нас']]],
];

export function Footer() {
  return (
    <footer className="bg-[#faf8f7] pt-12 pb-6">
      <div className="container-x">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="sm:col-span-2 lg:col-span-1"><Logo align="start" /><p className="mt-3 text-[13px] text-muted">Сладости, которые делают расстояния меньше.</p></div>
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
