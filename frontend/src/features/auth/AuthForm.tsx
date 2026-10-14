'use client';
import { useState, type FormEvent } from 'react';
import { useShop } from '@/features/shop/store';
import { askWriteAccess, tgInitData } from '@/features/telegram/miniApp';
import { post } from '@/shared/api/client';
import type { User } from '@/shared/api/types';
import { cn } from '@/shared/lib/format';

/** Вход и регистрация по телефону и паролю. Cookie сессии ставит бэкенд. */
export function AuthForm({ mode: initial = 'login', allowRegister = true, onDone }: {
  mode?: 'login' | 'register'; allowRegister?: boolean; onDone: (u: User) => void;
}) {
  const { setUser } = useShop();
  const [mode, setMode] = useState(initial);
  const [v, setV] = useState({ name: '', phone: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const reg = mode === 'register';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (v.phone.replace(/\D/g, '').length < 10) { setErr('Введите номер телефона полностью'); return; }
    if (reg && !v.name.trim()) { setErr('Укажите имя'); return; }
    if (reg && v.password.length < 8) { setErr('Пароль — не короче 8 символов'); return; }
    setBusy(true); setErr('');
    try {
      const u = await post<User>(reg ? '/api/auth/register' : '/api/auth/login',
        { ...(reg ? v : { phone: v.phone, password: v.password }), tg_init_data: tgInitData() });
      setUser(u);
      if (u.telegram) askWriteAccess();
      onDone(u);
    } catch (ex) { setErr((ex as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div>
      {allowRegister && (
        <div className="mb-4 grid grid-cols-2 rounded-lg bg-soft p-1 text-sm" role="tablist">
          {(['login', 'register'] as const).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setErr(''); }}
              className={cn('rounded-md py-2.5 font-semibold', mode === m ? 'bg-white text-accent shadow-sm' : 'text-muted')}>
              {m === 'login' ? 'Вход' : 'Регистрация'}
            </button>
          ))}
        </div>
      )}
      <form onSubmit={submit} className="space-y-3" noValidate>
        {reg && <label className="field"><span className="label">Имя</span><input className="input" autoComplete="name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></label>}
        <label className="field"><span className="label">Телефон</span><input className="input" type="tel" autoComplete="tel" placeholder="+7 (___) ___-__-__" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /></label>
        <label className="field"><span className="label">Пароль</span><input className="input" type="password" autoComplete={reg ? 'new-password' : 'current-password'} value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} />
          {reg && <span className="hint">Не короче 8 символов</span>}</label>
        {err && <p role="alert" className="text-xs text-accent">{err}</p>}
        <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Подождите…' : reg ? 'Зарегистрироваться' : 'Войти'}</button>
      </form>
    </div>
  );
}
