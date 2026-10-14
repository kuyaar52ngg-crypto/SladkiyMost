'use client';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { AccountHead } from '@/features/account/page';
import { Card, Info, Toggle } from '@/features/account/parts';
import { useShop } from '@/features/shop/store';
import { TelegramConnect } from '@/features/telegram/TelegramConnect';
import { post, put } from '@/shared/api/client';
import type { RegionId, User } from '@/shared/api/types';
import { cn } from '@/shared/lib/format';

export default function AccountProfile() {
  const { user, setUser, meta, toast } = useShop();
  const router = useRouter();
  const initial = { name: user?.name || '', phone: user?.phone || '', email: user?.email || '' };
  const [v, setV] = useState(initial);
  const [saved, setSaved] = useState('');
  const [err, setErr] = useState('');
  const [pw, setPw] = useState<{ current: string; next: string } | null>(null);
  const [pwErr, setPwErr] = useState('');
  if (!user) return null;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!v.name.trim()) { setErr('Укажите имя и фамилию'); return; }
    if (v.phone.replace(/\D/g, '').length < 10) { setErr('Введите номер телефона полностью'); return; }
    try {
      setUser(await put<User>('/api/account/profile', { name: v.name, phone: v.phone, email: v.email }));
      setErr(''); setSaved('Изменения сохранены');
    } catch (ex) { setErr((ex as Error).message); setSaved(''); }
  };
  const setting = async (patch: Partial<User>) => {
    try { setUser(await put<User>('/api/account/profile', patch)); setSaved('Настройки сохранены'); }
    catch (ex) { toast((ex as Error).message); }
  };
  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!pw) return;
    if (pw.next.length < 8) { setPwErr('Новый пароль — не короче 8 символов'); return; }
    try { await post('/api/account/password', { current: pw.current, new: pw.next }); setPw(null); setPwErr(''); toast('Пароль изменён'); }
    catch (ex) { setPwErr((ex as Error).message); }
  };
  const logout = async () => { await post('/api/auth/logout').catch(() => null); setUser(null); router.push('/'); };
  const dirty = v.name !== user.name || v.phone !== user.phone || v.email !== (user.email || '');

  return (
    <>
      <AccountHead title="Мои данные" />
      {saved && <Info className="mb-6">✓ {saved}</Info>}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <form onSubmit={save} noValidate className="rounded-card border border-line p-6">
          <h2 className="h3">Личная информация</h2>
          <span className="pill mt-3">Редактирование профиля</span>
          <div className="mt-5 space-y-4">
            <label className="field"><span className="label">Имя и фамилия *</span><input className={cn('input', err && !v.name.trim() && 'input-invalid')} autoComplete="name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></label>
            <label className="field"><span className="label">Телефон *</span><input className="input" type="tel" autoComplete="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />
              <span className="hint">По этому номеру вы входите в кабинет.</span></label>
            <label className="field"><span className="label">Электронная почта</span><input className="input" type="email" autoComplete="email" placeholder="Для чеков и информации о заказе" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></label>
          </div>
          {err && <p role="alert" className="mt-4 text-[13px] text-accent">{err}</p>}
          <div className="mt-6 flex flex-wrap gap-3">
            <button className="btn btn-primary" disabled={!dirty}>Сохранить изменения</button>
            <button type="button" className="btn" onClick={() => { setV(initial); setErr(''); }}>Отмена</button>
          </div>
        </form>

        <Card title="Настройки профиля">
          <label className="field"><span className="label">Регион получения</span>
            <select className="select" value={user.region || ''} onChange={(e) => setting({ region: (e.target.value || null) as RegionId | null })}>
              <option value="" disabled>Выберите регион</option>
              {(Object.keys(meta.regions) as RegionId[]).map((r) => <option key={r} value={r}>{meta.regions[r].name}</option>)}
            </select></label>
          <div className="mt-3 divide-y divide-line">
            <Toggle label="Уведомления о заказах" on={user.notify_orders} onChange={(x) => setting({ notify_orders: x })} />
            <Toggle label="Новости и подборки" on={user.notify_news} onChange={(x) => setting({ notify_news: x })} />
          </div>
          <p className="mt-4 text-[15px] text-muted">Уведомления приходят в ленту кабинета{user.telegram ? ' и в Telegram' : ''}. Каналы по каждому типу — в разделе «Уведомления».</p>
          {!user.telegram && <TelegramConnect className="mt-4" />}
        </Card>
      </div>

      <Card className="mt-6" title="Безопасность">
        {pw ? (
          <form onSubmit={changePassword} noValidate className="grid max-w-[640px] gap-4 sm:grid-cols-2">
            <label className="field"><span className="label">Текущий пароль</span><input className="input" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></label>
            <label className="field"><span className="label">Новый пароль</span><input className="input" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /><span className="hint">Не короче 8 символов</span></label>
            {pwErr && <p role="alert" className="text-[13px] text-accent sm:col-span-2">{pwErr}</p>}
            <div className="flex flex-wrap gap-3 sm:col-span-2"><button className="btn btn-primary">Сохранить пароль</button><button type="button" className="btn" onClick={() => { setPw(null); setPwErr(''); }}>Отмена</button></div>
          </form>
        ) : (
          <>
            <p className="text-[15px]">Пароль скрыт. Не передавайте пароль и сведения об оплате другим людям.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" className="btn btn-primary" onClick={() => setPw({ current: '', next: '' })}>Изменить пароль</button>
              <button type="button" className="btn" onClick={logout}>Выйти из кабинета</button>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
