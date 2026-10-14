'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useShop } from '@/features/shop/store';
import { post } from '@/shared/api/client';
import { cn } from '@/shared/lib/format';
import { Logo } from '@/widgets/Logo';

const TABS = [['/admin', 'Дашборд'], ['/admin/waves', 'Сборные партии'], ['/admin/orders', 'Заказы'], ['/admin/products', 'Товары']] as const;
const TITLES: Record<string, string> = Object.fromEntries(TABS);

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { user, setUser } = useShop();
  const isLogin = path === '/admin/login';
  const allowed = user?.role === 'admin';

  useEffect(() => {
    if (!isLogin && user !== undefined && !allowed) router.replace(`/admin/login?next=${encodeURIComponent(path)}`);
  }, [isLogin, user, allowed, path, router]);

  if (isLogin) return <>{children}</>;
  if (!allowed) return <div className="py-24 text-center text-muted">Загружаем…</div>;

  const logout = async () => {
    await post('/api/auth/logout').catch(() => null);
    setUser(null);
    router.replace('/admin/login');
  };

  return (
    <div className="grid min-h-screen md:grid-cols-[220px_1fr]">
      <nav aria-label="Разделы администратора" className="flex items-center gap-1.5 overflow-x-auto border-b border-line px-4 py-3 md:sticky md:top-0 md:h-screen md:flex-col md:items-stretch md:border-r md:border-b-0 md:py-6">
        <div className="mb-7 hidden md:block"><Logo href="/admin" /></div>
        {TABS.map(([href, t]) => <Link key={href} href={href} className={cn('rounded-lg px-3 py-2.5 text-sm whitespace-nowrap', path === href ? 'bg-accent/5 text-accent' : '')}>{t}</Link>)}
        <Link href="/" className="rounded-lg px-3 py-2.5 text-sm whitespace-nowrap">← На сайт</Link>
        <button className="rounded-lg px-3 py-2.5 text-left text-sm text-muted md:mt-6" onClick={logout}>Выйти</button>
      </nav>
      <main className="min-w-0 px-4 pt-5 pb-16 md:px-8 md:pt-6">
        <div className="mb-5 flex items-center justify-between"><b>Управление маркетплейсом</b><span className="tag tag-muted">{user.name} · {user.phone}</span></div>
        <p className="text-[13px] text-muted">Панель администратора / {TITLES[path] || ''}</p>
        <h1 className="mt-2 mb-6 font-brand text-[26px] font-extrabold md:text-4xl">{TITLES[path] || 'Админка'}</h1>
        {children}
      </main>
    </div>
  );
}
