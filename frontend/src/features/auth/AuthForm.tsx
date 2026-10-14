'use client';
import Link from 'next/link';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useShop } from '@/features/shop/store';
import { askWriteAccess, tgInitData } from '@/features/telegram/miniApp';
import { post } from '@/shared/api/client';
import type { User } from '@/shared/api/types';
import { cn } from '@/shared/lib/format';

type Field = 'name' | 'phone' | 'email' | 'password' | 'repeat' | 'consent';
const digits = (s: string) => s.replace(/\D/g, '');

/** Поле формы с ошибкой рядом (правила валидации из макета). */
function Row({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      {children}
      {error ? <span role="alert" className="text-xs text-accent">{error}</span> : hint && <span className="hint">{hint}</span>}
    </label>
  );
}

function Secret({ label, value, onChange, placeholder, auto, bad }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; auto: string; bad?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative block">
      <input aria-label={label} className={cn('input pr-24', bad && 'input-invalid')} type={show ? 'text' : 'password'} autoComplete={auto} placeholder={placeholder}
        value={value} onChange={(e) => onChange(e.target.value)} />
      <button type="button" className="absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted hover:text-accent" onClick={() => setShow(!show)}>{show ? 'Скрыть' : 'Показать'}</button>
    </span>
  );
}

/** Вход и регистрация по телефону и паролю. Cookie сессии ставит бэкенд. */
export function AuthForm({ mode, onDone, next }: { mode: 'login' | 'register'; onDone: (u: User) => void; next: string }) {
  const { setUser } = useShop();
  const [v, setV] = useState({ name: '', phone: '', email: '', password: '', repeat: '', consent: false });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [common, setCommon] = useState('');
  const [busy, setBusy] = useState(false);
  const reg = mode === 'register';
  const q = `?next=${encodeURIComponent(next)}`;

  const validate = () => {
    const e: Partial<Record<Field, string>> = {};
    if (reg && v.name.trim().length < 2) e.name = 'Укажите имя и фамилию';
    if (digits(v.phone).length < 10 || digits(v.phone).length > 11) e.phone = 'Введите номер телефона полностью';
    if (reg && v.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email.trim())) e.email = 'Проверьте адрес почты';
    if (!v.password) e.password = 'Введите пароль';
    else if (reg && v.password.length < 8) e.password = 'Не менее 8 символов';
    if (reg && v.repeat !== v.password) e.repeat = 'Пароли не совпадают';
    if (reg && !v.consent) e.consent = 'Подтвердите согласие на обработку персональных данных';
    return e;
  };
  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) { setCommon(reg ? 'Проверьте данные регистрации' : 'Проверьте телефон и пароль'); return; }
    setBusy(true); setCommon('');
    try {
      const body = reg ? { name: v.name, phone: v.phone, email: v.email.trim() || null, password: v.password } : { phone: v.phone, password: v.password };
      const u = await post<User>(reg ? '/api/auth/register' : '/api/auth/login', { ...body, tg_init_data: tgInitData() });
      setUser(u);
      if (u.telegram) askWriteAccess();
      onDone(u);
    } catch (ex) { setCommon((ex as Error).message); }
    finally { setBusy(false); }
  };
  const set = (k: keyof typeof v, value: string | boolean) => { setV({ ...v, [k]: value }); if (errors[k as Field]) setErrors({ ...errors, [k]: undefined }); };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {common && <div role="alert" className="rounded-card border-l-4 border-accent bg-pink px-4 py-3 text-[13px]"><b className="block text-accent">Ошибка</b>{common}</div>}
      {reg && <Row label="Имя" error={errors.name}><input aria-label="Имя" className={cn('input', errors.name && 'input-invalid')} autoComplete="name" placeholder="Как к вам обращаться" value={v.name} onChange={(e) => set('name', e.target.value)} /></Row>}
      <Row label="Телефон" error={errors.phone} hint={reg ? 'Этот номер будет логином для входа' : 'Номер, указанный при регистрации'}>
        <input aria-label="Телефон" className={cn('input', errors.phone && 'input-invalid')} type="tel" autoComplete="tel" placeholder="+7 (___) ___-__-__" value={v.phone} onChange={(e) => set('phone', e.target.value)} />
      </Row>
      {reg && (
        <Row label="Электронная почта (необязательно)" error={errors.email} hint="Пригодится, чтобы восстановить пароль">
          <input aria-label="Почта" className={cn('input', errors.email && 'input-invalid')} type="email" autoComplete="email" placeholder="name@mail.ru" value={v.email} onChange={(e) => set('email', e.target.value)} />
        </Row>
      )}
      <Row label="Пароль" error={errors.password} hint={reg ? 'Не менее 8 символов' : undefined}>
        <Secret label="Пароль" value={v.password} onChange={(x) => set('password', x)} placeholder={reg ? 'Придумайте пароль' : 'Введите пароль'} auto={reg ? 'new-password' : 'current-password'} bad={!!errors.password} />
      </Row>
      {reg && (
        <Row label="Повтор пароля" error={errors.repeat}>
          <Secret label="Повтор пароля" value={v.repeat} onChange={(x) => set('repeat', x)} placeholder="Введите пароль ещё раз" auto="new-password" bad={!!errors.repeat} />
        </Row>
      )}
      {reg && (
        <div>
          <label className="check"><input type="checkbox" checked={v.consent} onChange={(e) => set('consent', e.target.checked)} />
            <span>Согласен(на) с <Link className="text-accent underline underline-offset-2" href="/about#privacy">политикой конфиденциальности</Link></span></label>
          {errors.consent && <p role="alert" className="mt-1.5 text-xs text-accent">{errors.consent}</p>}
        </div>
      )}
      <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Подождите…' : reg ? 'Зарегистрироваться' : 'Войти'}</button>
      {!reg && <p className="text-center text-[13px]"><Link className="text-accent underline underline-offset-2" href="/reset">Забыли пароль?</Link></p>}
      <div className="border-t border-line pt-5 text-center text-[13px] text-muted">
        {reg ? <>Уже есть аккаунт? <Link className="font-semibold text-accent" href={`/login${q}`}>Войти</Link></>
          : <>Впервые в «Сладком мосте»?<Link className="btn mt-3 w-full" href={`/login${q}&mode=register`}>Зарегистрироваться</Link></>}
      </div>
    </form>
  );
}
