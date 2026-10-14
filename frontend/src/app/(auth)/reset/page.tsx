'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useShop } from '@/features/shop/store';
import { post } from '@/shared/api/client';
import type { User } from '@/shared/api/types';
import { cn } from '@/shared/lib/format';
import { Icon } from '@/shared/ui';

type Link_ = { token?: string; access_token?: string; error?: string };

/** Ссылка из Telegram (?t=…) или из письма Supabase (#access_token=…). */
function readLink(): Link_ {
  const q = new URLSearchParams(window.location.search);
  const h = new URLSearchParams(window.location.hash.slice(1));
  if (window.location.hash) window.history.replaceState(null, '', window.location.pathname + window.location.search);
  if (h.get('error_description')) return { error: h.get('error_description')!.replace(/\+/g, ' ') };
  if (h.get('access_token')) return { access_token: h.get('access_token')! };
  if (q.get('t')) return { token: q.get('t')! };
  return {};
}

const home = (u: User) => (u.role === 'admin' ? '/admin' : u.role === 'seller' ? '/seller' : '/account');

function Request({ linkError }: { linkError?: string }) {
  const [login, setLogin] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState(linkError ? 'Ссылка недействительна или устарела — запросите новую.' : '');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v = login.trim();
    if (!v.includes('@') && v.replace(/\D/g, '').length < 10) { setErr('Укажите телефон полностью или электронную почту'); return; }
    setBusy(true); setErr('');
    try { await post('/api/auth/reset/request', { login: v }); setSent(true); }
    catch (ex) { setErr((ex as Error).message); }
    finally { setBusy(false); }
  };
  if (sent) return (
    <div className="rounded-card border border-line p-5">
      <p className="font-semibold">Проверьте почту и Telegram</p>
      <p className="mt-2 text-[13px] text-muted">Если аккаунт найден, мы отправили ссылку для смены пароля: на почту из профиля и в Telegram, если он подключён. Ссылка из Telegram действует 1 час.</p>
      <p className="mt-3 text-[13px] text-muted">Письма нет несколько минут? Загляните в «Спам» или <button type="button" className="text-accent underline underline-offset-2" onClick={() => setSent(false)}>отправьте ещё раз</button>.</p>
    </div>
  );
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {err && <div role="alert" className="rounded-card border-l-4 border-accent bg-pink px-4 py-3 text-[13px]">{err}</div>}
      <label className="field"><span className="label">Телефон или электронная почта</span>
        <input aria-label="Телефон или почта" className={cn('input', err && 'input-invalid')} autoComplete="username" placeholder="+7 (___) ___-__-__ или name@mail.ru" value={login} onChange={(e) => setLogin(e.target.value)} />
        <span className="hint">По телефону ссылка придёт в Telegram (если он подключён) и на почту из профиля</span>
      </label>
      <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Отправляем…' : 'Получить ссылку'}</button>
      <p className="text-center text-xs text-muted">Нет ни почты, ни Telegram? <Link className="text-accent underline underline-offset-2" href="/account/support">Напишите нам</Link> — восстановим доступ по номеру телефона.</p>
    </form>
  );
}

function NewPassword({ link }: { link: Link_ }) {
  const { setUser } = useShop();
  const router = useRouter();
  const [v, setV] = useState({ password: '', repeat: '' });
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (v.password.length < 8) { setErr('Пароль — не менее 8 символов'); return; }
    if (v.password !== v.repeat) { setErr('Пароли не совпадают'); return; }
    setBusy(true); setErr('');
    try {
      const u = await post<User>('/api/auth/reset/confirm', { password: v.password, token: link.token ?? '', access_token: link.access_token ?? '' });
      setUser(u);
      router.replace(home(u));
    } catch (ex) { setErr((ex as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {err && <div role="alert" className="rounded-card border-l-4 border-accent bg-pink px-4 py-3 text-[13px]">{err}</div>}
      <label className="field"><span className="label">Новый пароль</span>
        <input aria-label="Новый пароль" className="input" type={show ? 'text' : 'password'} autoComplete="new-password" placeholder="Не менее 8 символов" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} />
      </label>
      <label className="field"><span className="label">Повтор пароля</span>
        <input aria-label="Повтор пароля" className="input" type={show ? 'text' : 'password'} autoComplete="new-password" placeholder="Введите пароль ещё раз" value={v.repeat} onChange={(e) => setV({ ...v, repeat: e.target.value })} />
      </label>
      <label className="check"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />Показать пароль</label>
      <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Сохраняем…' : 'Сохранить и войти'}</button>
    </form>
  );
}

export default function ResetPage() {
  const [link, setLink] = useState<Link_ | null>(null);
  useEffect(() => setLink(readLink()), []);
  const confirm = !!(link?.token || link?.access_token);
  return (
    <main className="mx-auto min-h-screen max-w-[480px] px-4 py-10 md:py-16">
      <Link href="/login" className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-accent"><Icon name="back" className="size-4" />Ко входу</Link>
      <h1 className="font-head text-[32px] font-bold">{confirm ? 'Новый пароль' : 'Восстановление пароля'}</h1>
      <p className="mt-2 mb-6 text-[15px] text-muted">{confirm ? 'Придумайте новый пароль — после сохранения вы сразу войдёте в аккаунт.' : 'Пришлём ссылку для смены пароля на почту или в Telegram.'}</p>
      {link === null ? <p className="text-muted">Загружаем…</p> : confirm ? <NewPassword link={link} /> : <Request linkError={link.error} />}
    </main>
  );
}
