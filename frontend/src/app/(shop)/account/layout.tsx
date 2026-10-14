'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useShop } from '@/features/shop/store';
import { post } from '@/shared/api/client';
import { cn } from '@/shared/lib/format';
import { Logo } from '@/widgets/Logo';

const ACCOUNT_NAV = [
  ['/account', 'Обзор'],
  ['/account/orders', 'Мои заказы'],
  ['/account/tracking', 'Отслеживание доставки'],
  ['/account/favorites', 'Избранное'],
  ['/account/addresses', 'Мои адреса'],
  ['/account/profile', 'Мои данные'],
  ['/account/gifts', 'Подарки и открытки'],
  ['/account/notifications', 'Уведомления'],
  ['/account/support', 'Поддержка'],
] as const;

const active = (path: string, href: string) => (href === '/account' ? path === href : path.startsWith(href));

/** Личный кабинет покупателя: боковое меню (на телефоне — горизонтальная лента) и защищённые страницы. */
export default function AccountLayout({ children }: { children: ReactNode }) {
  const { user, setUser } = useShop();
  const path = usePathname();
  const router = useRouter();
  useEffect(() => { if (user === null) router.replace(`/login?next=${encodeURIComponent(path)}`); }, [user, path, router]);

  const logout = async () => {
    await post('/api/auth/logout').catch(() => null);
    setUser(null);
    router.push('/');
  };

  return (
    <div className="container-x pt-4 pb-20 md:pt-10">
      <div className="md:grid md:grid-cols-[200px_1fr] md:gap-8">
        <aside className="md:border-r md:border-line md:pr-5">
          <div className="mb-8 hidden md:block"><Logo align="start" /></div>
          <nav aria-label="Личный кабинет" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-3 text-sm md:mx-0 md:block md:space-y-1.5 md:overflow-visible md:px-0 md:pb-0">
            {ACCOUNT_NAV.map(([href, t]) => (
              <Link key={href} href={href} aria-current={active(path, href) ? 'page' : undefined}
                className={cn('block shrink-0 rounded-lg px-3 py-3 whitespace-nowrap md:whitespace-normal',
                  active(path, href) ? 'bg-pink font-semibold text-accent' : 'max-md:border max-md:border-line hover:text-accent')}>
                {t}
              </Link>
            ))}
            {user?.role === 'admin' && <Link href="/admin" className="block shrink-0 rounded-lg px-3 py-3 whitespace-nowrap text-accent max-md:border max-md:border-line">Админ-панель</Link>}
          </nav>
          <button type="button" onClick={logout} className="mt-10 hidden text-[15px] hover:text-accent md:block">Выйти</button>
        </aside>
        <div className="min-w-0 pt-4 md:pt-0">
          {user ? children : <p className="py-24 text-center text-muted">Загружаем…</p>}
          <button type="button" onClick={logout} className="btn mt-10 w-full md:hidden">Выйти из кабинета</button>
        </div>
      </div>
    </div>
  );
}
