'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useShop } from '@/features/shop/store';
import { cn } from '@/shared/lib/format';
import { Icon } from '@/shared/ui';
import { Logo } from './Logo';

const NAV = [['/catalog', 'Каталог'], ['/delivery', 'Сборная доставка'], ['/gift', 'Подарки'], ['/about', 'О нас']] as const;

export function Header() {
  const path = usePathname();
  const { count, ready, user } = useShop();
  return (
    <>
      <div className="bg-ink px-3 py-2 text-center text-xs text-white">Соединяем регионы через вкус и эмоции</div>
      <header className="sticky top-0 z-30 border-b border-line bg-white">
        <div className="container-x flex min-h-[72px] items-center justify-between gap-6 md:min-h-24">
          <Logo />
          <nav aria-label="Основная навигация" className="hidden gap-7 text-sm md:flex">
            {NAV.map(([href, t]) => (
              <Link key={href} href={href} className={cn('border-b-[1.5px] py-1.5 hover:border-accent', path.startsWith(href) ? 'border-accent' : 'border-transparent')}>{t}</Link>
            ))}
          </nav>
          <div className="flex items-center gap-5 text-[13px]">
            <Link href="/catalog?focus=1" aria-label="Поиск" className="p-1"><Icon name="search" /></Link>
            <Link href={user === null ? '/login' : user?.role === 'admin' ? '/admin' : '/account'} className="hidden items-center gap-2 p-1 md:flex"><Icon name="user" />{user === null ? 'Войти' : user?.role === 'admin' ? 'Админ-панель' : 'Мои заказы'}</Link>
            <Link href="/cart" aria-label={`Корзина: ${count}`} className="flex items-center gap-2 p-1">
              <Icon name="bag" /><span className="font-semibold text-accent">{ready && count ? count : ''}</span>
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}

export function TabBar() {
  const path = usePathname();
  const { count } = useShop();
  const tabs = [['/catalog', 'grid', 'Каталог'], ['/favorites', 'heart', 'Избранное'], ['/cart', 'bag', 'Корзина'], ['/account', 'user', 'Кабинет']] as const;
  return (
    <nav aria-label="Навигация магазина" className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-line bg-white px-1 pt-2 pb-[calc(8px+env(safe-area-inset-bottom,0px))] md:hidden">
      {tabs.map(([href, icon, t]) => (
        <Link key={href} href={href} className={cn('relative flex flex-col items-center gap-1 text-[11px]', path.startsWith(href) ? 'text-accent' : 'text-muted')}>
          <Icon name={icon} />{t}
          {href === '/cart' && count > 0 && <span className="absolute -top-1 left-[55%] grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] text-white">{count}</span>}
        </Link>
      ))}
    </nav>
  );
}
