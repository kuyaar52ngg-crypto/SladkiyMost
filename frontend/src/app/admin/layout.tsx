'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { post } from '@/shared/api/client';
import { cn } from '@/shared/lib/format';
import { Logo } from '@/widgets/Logo';

const TABS = [['/admin', 'Дашборд'], ['/admin/waves', 'Сборные партии'], ['/admin/orders', 'Заказы'], ['/admin/products', 'Товары']] as const;
const TITLES: Record<string, string> = Object.fromEntries(TABS);

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [auth, setAuth] = useState<boolean | null>(null);
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!localStorage.getItem('sm-admin')) { setAuth(false); return; }
    post('/api/admin/login').then(() => setAuth(true)).catch(() => { localStorage.removeItem('sm-admin'); setAuth(false); });
  }, []);

  const login = async (e: FormEvent) => {
    e.preventDefault();
    localStorage.setItem('sm-admin', pw);
    try { await post('/api/admin/login'); setAuth(true); } catch { localStorage.removeItem('sm-admin'); setErr('Неверный пароль'); }
  };

  if (auth === null) return <div className="py-24 text-center text-muted">Загружаем…</div>;
  if (!auth) return (
    <main className="container-x max-w-[480px] py-12">
      <div className="mb-6 flex justify-center"><Logo /></div>
      <div className="card"><h2 className="h2">Кабинет администратора</h2><p className="mt-2 text-muted">Управление товарами, волнами и статусами заказов.</p>
        <form onSubmit={login} className="mt-4 space-y-3">
          <label className="field"><span className="label">Пароль</span><input className="input" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
          {err && <p className="text-xs text-accent">{err}</p>}
          <button className="btn btn-primary w-full">Войти</button>
        </form>
        <p className="mt-3 text-xs text-muted">Пароль задаётся в бэкенде переменной ADMIN_TOKEN (по умолчанию <b>admin</b>).</p></div>
      <p className="mt-4 text-center"><Link className="link" href="/">← Вернуться на сайт</Link></p>
    </main>
  );

  return (
    <div className="grid min-h-screen md:grid-cols-[220px_1fr]">
      <nav aria-label="Разделы администратора" className="flex items-center gap-1.5 overflow-x-auto border-b border-line px-4 py-3 md:sticky md:top-0 md:h-screen md:flex-col md:items-stretch md:border-r md:border-b-0 md:py-6">
        <div className="mb-7 hidden md:block"><Logo href="/admin" /></div>
        {TABS.map(([href, t]) => <Link key={href} href={href} className={cn('rounded-lg px-3 py-2.5 text-sm whitespace-nowrap', path === href ? 'bg-accent/5 text-accent' : '')}>{t}</Link>)}
        <Link href="/" className="rounded-lg px-3 py-2.5 text-sm whitespace-nowrap">← На сайт</Link>
        <button className="rounded-lg px-3 py-2.5 text-left text-sm text-muted md:mt-6" onClick={() => { localStorage.removeItem('sm-admin'); setAuth(false); router.refresh(); }}>Выйти</button>
      </nav>
      <main className="min-w-0 px-4 pt-5 pb-16 md:px-8 md:pt-6">
        <div className="mb-5 flex items-center justify-between"><b>Управление маркетплейсом</b><span className="tag tag-muted">Администратор</span></div>
        <p className="text-[13px] text-muted">Панель администратора / {TITLES[path] || ''}</p>
        <h1 className="mt-2 mb-6 font-brand text-[26px] font-extrabold md:text-4xl">{TITLES[path] || 'Админка'}</h1>
        {children}
      </main>
    </div>
  );
}
