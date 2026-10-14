'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { useShop } from '@/features/shop/store';
import { post } from '@/shared/api/client';
import type { User } from '@/shared/api/types';
import { Icon } from '@/shared/ui';
import { Logo } from '@/widgets/Logo';

function SellerLogin() {
  const { user, setUser } = useShop();
  const router = useRouter();
  const raw = useSearchParams().get('next') || '/seller';
  const next = raw.startsWith('/seller') ? raw : '/seller';
  const [v, setV] = useState({ phone: '', password: '' });
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (user?.role === 'seller') router.replace(next); }, [user, next, router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (v.phone.replace(/\D/g, '').length < 10 || !v.password) { setErr('Введите телефон и пароль'); return; }
    setBusy(true); setErr('');
    try {
      const u = await post<User>('/api/auth/login', v);
      if (u.role !== 'seller') { await post('/api/auth/logout').catch(() => null); setUser(null); setErr('Этот аккаунт не привязан к магазину'); return; }
      setUser(u); router.replace(next);
    } catch (ex) { setErr((ex as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-[1200px] flex-col px-4 sm:px-6">
      <header className="flex items-center justify-between border-b border-line py-5"><Logo align="start" /><span className="pill pill-soft">Кабинет поставщика</span></header>
      <main className="grid flex-1 items-start gap-10 py-12 md:grid-cols-2 md:gap-16">
        <div>
          <h1 className="font-head text-[32px] leading-tight font-bold md:text-[40px]">Ваш магазин —<br />в одном кабинете</h1>
          <p className="mt-4 text-[15px] text-muted">Управляйте товарами, готовьте заказы к сборным партиям и следите за продажами.</p>
          <div className="mt-8 rounded-card border border-line p-6">
            <h2 className="font-head text-xl font-bold">Доступ поставщика</h2>
            <p className="mt-3 text-sm text-muted">Только товары и заказы вашего магазина. Публикация товаров — после проверки администратором. Объединение заказов в партии и доставку согласует площадка.</p>
          </div>
        </div>
        <form onSubmit={submit} noValidate className="rounded-card border border-line p-6 sm:p-7">
          <h2 className="font-head text-[26px] font-bold">Вход в кабинет магазина</h2>
          <p className="mt-2 text-[13px] text-muted">Используйте телефон и пароль, выданные при подключении магазина.</p>
          <label className="field mt-6"><span className="label">Телефон *</span><input className="input" type="tel" autoComplete="tel" placeholder="+7 (___) ___-__-__" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /></label>
          <label className="field mt-4"><span className="label">Пароль *</span><input className="input" type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="Введите пароль" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} /></label>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-muted"><input type="checkbox" className="accent-accent" checked={show} onChange={(e) => setShow(e.target.checked)} />Показать пароль</label>
          {err && <p role="alert" className="mt-4 rounded-card bg-pink px-4 py-3 text-[13px] text-accent">{err}</p>}
          <button className="btn btn-primary mt-6 w-full" disabled={busy}>{busy ? 'Входим…' : 'Войти в магазин'}</button>
          <p className="mt-5 text-xs text-muted"><Link className="text-accent underline underline-offset-2" href="/reset">Забыли пароль?</Link> Нет доступа? Магазин подключает администратор площадки — напишите нам через «Задать вопрос».</p>
          <Link className="mt-4 inline-flex items-center gap-1.5 text-[13px] text-accent" href="/"><Icon name="back" className="size-4" />Вернуться в магазин</Link>
        </form>
      </main>
    </div>
  );
}

export default function Page() {
  return <Suspense><SellerLogin /></Suspense>;
}
