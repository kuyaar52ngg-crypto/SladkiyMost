'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { useShop } from '@/features/shop/store';
import { post } from '@/shared/api/client';
import type { User } from '@/shared/api/types';
import { Icon } from '@/shared/ui';
import { Logo } from '@/widgets/Logo';

function AdminLogin() {
  const { user, setUser } = useShop();
  const router = useRouter();
  const raw = useSearchParams().get('next') || '/admin';
  const next = raw.startsWith('/admin') ? raw : '/admin';
  const [v, setV] = useState({ phone: '', password: '' });
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (user?.role === 'admin') router.replace(next); }, [user, next, router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (v.phone.replace(/\D/g, '').length < 10 || !v.password) { setErr('Введите телефон и пароль'); return; }
    setBusy(true); setErr('');
    try {
      const u = await post<User>('/api/auth/login', v);
      if (u.role !== 'admin') {
        await post('/api/auth/logout').catch(() => null);
        setUser(null); setErr('У этого аккаунта нет прав администратора'); return;
      }
      setUser(u); router.replace(next);
    } catch (ex) { setErr((ex as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-[1200px] flex-col px-4 sm:px-6">
      <header className="flex items-center justify-between border-b border-line py-5"><Logo align="start" /><span className="pill pill-soft">Администратор</span></header>
      <main className="flex-1 py-12">
        <form onSubmit={submit} noValidate className="mx-auto max-w-[440px] rounded-card border border-line p-6 sm:p-7">
          <h1 className="font-head text-[28px] font-bold">Вход в админ-панель</h1>
          <p className="mt-2 text-[13px] text-muted">Доступ только для сотрудников с правами администратора.</p>
          <label className="field mt-6"><span className="label">Телефон</span><input className="input" type="tel" autoComplete="tel" placeholder="+7 (___) ___-__-__" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /></label>
          <label className="field mt-4"><span className="label">Пароль</span><input className="input" type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="Введите пароль" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} /></label>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-muted"><input type="checkbox" className="accent-accent" checked={show} onChange={(e) => setShow(e.target.checked)} />Показать пароль</label>
          {err && <p role="alert" className="mt-4 text-[13px] text-accent">{err}</p>}
          <button className="btn btn-primary mt-6 w-full" disabled={busy}>{busy ? 'Входим…' : 'Войти в панель'}</button>
          <p className="mt-5 border-t border-line pt-4 text-xs text-muted">Нет доступа? Обратитесь к ответственному за платформу.</p>
        </form>
        <p className="mt-5 text-center"><Link className="inline-flex items-center gap-1.5 text-[13px] text-accent" href="/"><Icon name="back" className="size-4" />Вернуться в магазин</Link></p>
      </main>
    </div>
  );
}

export default function Page() {
  return <Suspense><AdminLogin /></Suspense>;
}
