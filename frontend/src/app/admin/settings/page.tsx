'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { Toggle } from '@/features/account/parts';
import { AdminHead, Panel } from '@/features/admin/ui';
import { useShop } from '@/features/shop/store';
import { TelegramConnect } from '@/features/telegram/TelegramConnect';
import { get, post, put } from '@/shared/api/client';
import type { PlatformSettings, User } from '@/shared/api/types';
import { rub } from '@/shared/lib/format';
import { Kv } from '@/shared/ui';

const NOTIFY = [['notify_orders', 'Новые заказы и отмены'], ['notify_waves', 'Сборные партии'], ['notify_support', 'Обращения и отзывы']] as const;

function Platform() {
  const { toast } = useShop();
  const [s, setS] = useState<PlatformSettings | null>(null);
  const [saved, setSaved] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => { get<PlatformSettings>('/api/admin/settings').then((x) => { setS(x); setSaved(JSON.stringify(x)); }).catch(() => null); }, []);
  if (!s) return <Panel title="Приём заказов"><p className="text-muted">Загружаем…</p></Panel>;
  const save = async () => {
    try { const x = await put<PlatformSettings>('/api/admin/settings', s); setS(x); setSaved(JSON.stringify(x)); setErr(''); toast('Настройки сохранены'); }
    catch (e) { setErr((e as Error).message); }
  };
  return (
    <Panel title="Приём заказов и отзывы">
      <Toggle label="Принимать заказы" on={s.orders_open} onChange={(v) => setS({ ...s, orders_open: v })} />
      {!s.orders_open && (
        <label className="field mb-3"><span className="label">Что увидят покупатели</span>
          <textarea className="input min-h-16" maxLength={300} value={s.orders_closed_message} onChange={(e) => setS({ ...s, orders_closed_message: e.target.value })} /></label>
      )}
      <label className="field mt-2"><span className="label">Минимальная сумма товаров в заказе, ₽</span>
        <input className="input max-w-48" type="number" min={0} max={1000000} step={100} value={s.min_order_rub} onChange={(e) => setS({ ...s, min_order_rub: Math.max(0, Number(e.target.value) || 0) })} />
        <span className="hint">{s.min_order_rub ? `Заказ меньше ${rub(s.min_order_rub)} оформить нельзя` : '0 — без ограничения'}</span>
      </label>
      <div className="mt-3 border-t border-line pt-1">
        <Toggle label="Проверять отзывы перед публикацией" on={s.reviews_premoderation} onChange={(v) => setS({ ...s, reviews_premoderation: v })} />
      </div>
      {err && <p role="alert" className="mt-2 text-[13px] text-accent">{err}</p>}
      <button type="button" className="btn btn-primary mt-4" disabled={JSON.stringify(s) === saved} onClick={save}>Сохранить</button>
    </Panel>
  );
}

function Account() {
  const { user, setUser, toast } = useShop();
  const [p, setP] = useState({ name: user?.name ?? '', email: user?.email ?? '' });
  const [pw, setPw] = useState({ current: '', next: '', repeat: '' });
  const [err, setErr] = useState('');
  if (!user) return null;
  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    try { setUser(await put<User>('/api/account/profile', { name: p.name, email: p.email.trim() || null })); toast('Данные сохранены'); setErr(''); }
    catch (ex) { setErr((ex as Error).message); }
  };
  const savePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (pw.next.length < 8) { setErr('Новый пароль — не менее 8 символов'); return; }
    if (pw.next !== pw.repeat) { setErr('Пароли не совпадают'); return; }
    try { await post('/api/account/password', { current: pw.current, new: pw.next }); setPw({ current: '', next: '', repeat: '' }); setErr(''); toast('Пароль изменён'); }
    catch (ex) { setErr((ex as Error).message); }
  };
  const notify = async (k: (typeof NOTIFY)[number][0], v: boolean) => {
    try { setUser(await put<User>('/api/account/profile', { [k]: v })); } catch (ex) { toast((ex as Error).message); }
  };
  return (
    <Panel title="Мой доступ">
      {err && <p role="alert" className="mb-3 rounded-card border-l-4 border-accent bg-pink px-4 py-3 text-[13px]">{err}</p>}
      <form onSubmit={saveProfile} className="grid gap-4 sm:grid-cols-2">
        <label className="field"><span className="label">Имя</span><input className="input" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></label>
        <label className="field"><span className="label">Почта для восстановления пароля</span><input className="input" type="email" value={p.email} onChange={(e) => setP({ ...p, email: e.target.value })} /></label>
        <div className="sm:col-span-2"><button className="btn btn-sm">Сохранить данные</button><span className="ml-3 text-xs text-muted">Вход по телефону {user.phone}</span></div>
      </form>
      <form onSubmit={savePassword} className="mt-6 grid gap-4 border-t border-line pt-5 sm:grid-cols-3">
        <label className="field"><span className="label">Текущий пароль</span><input className="input" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></label>
        <label className="field"><span className="label">Новый пароль</span><input className="input" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></label>
        <label className="field"><span className="label">Повтор</span><input className="input" type="password" autoComplete="new-password" value={pw.repeat} onChange={(e) => setPw({ ...pw, repeat: e.target.value })} /></label>
        <div className="sm:col-span-3"><button className="btn btn-sm" disabled={!pw.current || !pw.next}>Сменить пароль</button></div>
      </form>
      <div className="mt-6 border-t border-line pt-4">
        <h3 className="font-semibold">Уведомления в Telegram</h3>
        <div className="mt-2"><TelegramConnect /></div>
        {NOTIFY.map(([k, t]) => <Toggle key={k} label={t} on={user[k]} onChange={(v) => notify(k, v)} />)}
      </div>
    </Panel>
  );
}

export default function AdminSettings() {
  const { meta } = useShop();
  const p = meta.policy;
  return (
    <>
      <AdminHead title="Настройки" text="Правила площадки и ваш доступ администратора." />
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <div className="grid gap-6"><Platform />
          <Panel title="Логистика (по условиям кейса)" soft>
            <Kv k="Волна в каждом направлении" v={`раз в ${p.wave_interval_days} дней`} />
            <Kv k="Приём закрывается" v={`за ${p.cutoff_days_before} дня до отправки`} />
            <Kv k="Базовый тариф" v={`${p.base_tariff} ₽/кг`} />
            <Kv k="Загрузка партии" v={`${p.min_load_kg}–${p.max_load_kg} кг`} />
            <Kv k="Термоупаковка" v={rub(p.thermo_price)} />
            <Kv k="Подарочная коробка" v={rub(p.gift_box_price)} />
            <Kv k="Курьер" v={rub(p.courier_price)} />
            <p className="mt-3 text-xs text-muted">Тарифы и расписание заданы правилами доставки и меняются в коде расчёта, чтобы цены в уже оформленных заказах оставались согласованными.</p>
          </Panel>
        </div>
        <Account />
      </div>
    </>
  );
}
