'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useShop } from '@/features/shop/store';
import { get, post } from '@/shared/api/client';
import type { Notice } from '@/shared/api/types';
import { cn } from '@/shared/lib/format';
import { Icon } from '@/shared/ui';
import { Logo } from '@/widgets/Logo';

const NAV = [
  ['/admin', 'Дашборд'], ['/admin/orders', 'Заказы'], ['/admin/waves', 'Сборные партии'], ['/admin/products', 'Товары'], ['/admin/categories', 'Категории'],
  ['/admin/sellers', 'Продавцы'], ['/admin/customers', 'Покупатели'], ['/admin/reviews', 'Отзывы'], ['/admin/analytics', 'Аналитика'],
  ['/admin/content', 'Контент сайта'], ['/admin/settings', 'Настройки'],
] as const;
const active = (path: string, href: string) => (href === '/admin' ? path === href : path.startsWith(href));

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { user, setUser } = useShop();
  const [unread, setUnread] = useState(0);
  const isLogin = path === '/admin/login';
  const allowed = user?.role === 'admin';

  useEffect(() => {
    if (!isLogin && user !== undefined && !allowed) router.replace(`/admin/login?next=${encodeURIComponent(path)}`);
  }, [isLogin, user, allowed, path, router]);
  useEffect(() => {
    if (allowed && !isLogin) get<Notice[]>('/api/account/notifications').then((l) => setUnread(l.filter((n) => !n.read).length)).catch(() => null);
  }, [allowed, isLogin, path]);

  if (isLogin) return <>{children}</>;
  if (!allowed) return <div className="py-24 text-center text-muted">Загружаем…</div>;

  const logout = async () => {
    await post('/api/auth/logout').catch(() => null);
    setUser(null);
    router.replace('/admin/login');
  };

  return (
    <div className="mx-auto grid min-h-screen max-w-[1440px] grid-cols-[minmax(0,1fr)] md:grid-cols-[232px_minmax(0,1fr)]">
      <aside className="border-line md:sticky md:top-0 md:flex md:h-screen md:flex-col md:border-r md:px-6 md:py-8">
        <div className="hidden md:block"><Logo href="/admin" align="start" /></div>
        <nav aria-label="Разделы администратора" className="flex gap-1.5 overflow-x-auto border-b border-line px-4 py-3 text-sm md:mt-8 md:block md:space-y-1 md:border-0 md:p-0">
          {NAV.map(([href, t]) => (
            <Link key={href} href={href} aria-current={active(path, href) ? 'page' : undefined}
              className={cn('block shrink-0 rounded-lg px-3 py-2.5 whitespace-nowrap', active(path, href) ? 'bg-pink font-semibold text-accent' : 'hover:text-accent')}>{t}</Link>
          ))}
          <Link href="/" className="block shrink-0 rounded-lg px-3 py-2.5 whitespace-nowrap text-muted hover:text-accent">На сайт</Link>
        </nav>
        <div className="mt-auto hidden md:block">
          <p className="text-xs text-muted">{user.name} · {user.phone}</p>
          <button type="button" className="mt-3 text-sm hover:text-accent" onClick={logout}>Выйти</button>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="flex items-center justify-between gap-4 border-b border-line px-4 py-4 md:px-8">
          <b className="text-sm">Управление маркетплейсом</b>
          <div className="flex items-center gap-4">
            <Link href="/account/notifications" aria-label={`Уведомления${unread ? `: ${unread} новых` : ''}`} className="relative p-1">
              <Icon name="bell" />{unread > 0 && <span className="absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] text-white">{unread}</span>}
            </Link>
            <span className="pill pill-soft">Администратор</span>
            <button type="button" className="text-sm text-muted md:hidden" onClick={logout}>Выйти</button>
          </div>
        </header>
        <main className="px-4 pt-6 pb-16 md:px-8">{children}</main>
      </div>
    </div>
  );
}
