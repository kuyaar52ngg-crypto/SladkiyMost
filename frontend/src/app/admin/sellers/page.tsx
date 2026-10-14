'use client';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Info } from '@/features/account/parts';
import { AdminHead, Panel } from '@/features/admin/ui';
import { useShop } from '@/features/shop/store';
import { get, post } from '@/shared/api/client';
import type { RegionId, Shop, ShopStatus } from '@/shared/api/types';
import { cn } from '@/shared/lib/format';

const STATUS: Record<ShopStatus, string> = { pending: 'На проверке', active: 'Активен', blocked: 'Приостановлен' };
const BLANK = { name: '', region: 'YKT' as RegionId, contact_name: '', phone: '', email: '', login_phone: '', password: '', owner_name: '' };

export default function AdminSellers() {
  const { meta, toast } = useShop();
  const [list, setList] = useState<Shop[] | null>(null);
  const [q, setQ] = useState('');
  const [st, setSt] = useState<ShopStatus | ''>('');
  const [form, setForm] = useState<typeof BLANK | null>(null);
  const [err, setErr] = useState('');
  const [sel, setSel] = useState<Shop | null>(null);
  const [next, setNext] = useState<ShopStatus>('active');
  const [checked, setChecked] = useState(false);
  const load = useCallback(() => { get<Shop[]>('/api/admin/shops').then((l) => { setList(l); setSel((s) => (s ? l.find((x) => x.id === s.id) || null : null)); }).catch(() => setList([])); }, []);
  useEffect(load, [load]);
  const shown = (list || []).filter((s) => (!st || s.status === st) && (!q.trim() || `${s.name} ${s.contact_name} ${s.login_phone}`.toLowerCase().includes(q.trim().toLowerCase())));

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    if (form.name.trim().length < 2 || form.login_phone.replace(/\D/g, '').length < 10 || form.password.length < 8) { setErr('Укажите название, телефон для входа и пароль не короче 8 символов'); return; }
    try { await post('/api/admin/shops', { ...form, phone: form.phone || form.login_phone }); toast('Магазин подключён'); setForm(null); setErr(''); load(); }
    catch (ex) { setErr((ex as Error).message); }
  };
  const changeStatus = async () => {
    if (!sel || !checked) return;
    try { await post(`/api/admin/shops/${sel.id}/status`, { status: next }); toast(`«${sel.name}»: ${STATUS[next].toLowerCase()}`); setChecked(false); load(); }
    catch (ex) { toast((ex as Error).message); }
  };

  return (
    <>
      <AdminHead title="Продавцы" text="Магазины-поставщики: подключение, статус и товары на проверке.">
        <button type="button" className="btn btn-primary" onClick={() => { setForm(BLANK); setErr(''); }}>Подключить магазин</button>
      </AdminHead>
      {form && (
        <form onSubmit={create} noValidate className="mb-6 rounded-card border border-line p-5 sm:p-6">
          <h2 className="font-head text-xl font-bold">Новый магазин</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="field"><span className="label">Название *</span><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="field"><span className="label">Регион *</span><select className="select" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value as RegionId })}>{(Object.keys(meta.regions) as RegionId[]).map((r) => <option key={r} value={r}>{meta.regions[r].name}</option>)}</select></label>
            <label className="field"><span className="label">Контактное лицо</span><input className="input" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value, owner_name: e.target.value })} /></label>
            <label className="field"><span className="label">Телефон для входа *</span><input className="input" type="tel" placeholder="+7 (___) ___-__-__" value={form.login_phone} onChange={(e) => setForm({ ...form, login_phone: e.target.value })} /></label>
            <label className="field"><span className="label">Пароль для входа *</span><input className="input" type="text" autoComplete="off" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /><span className="hint">Не короче 8 символов — передайте поставщику</span></label>
            <label className="field"><span className="label">Почта</span><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          </div>
          {err && <p role="alert" className="mt-4 text-[13px] text-accent">{err}</p>}
          <div className="mt-5 flex flex-wrap gap-3"><button className="btn btn-primary">Создать магазин и доступ</button><button type="button" className="btn" onClick={() => setForm(null)}>Отмена</button></div>
        </form>
      )}
      <Panel>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field"><span className="label">Поиск по продавцам</span><input className="input" placeholder="Название, контакт или телефон" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          <label className="field"><span className="label">Статус</span><select className="select" value={st} onChange={(e) => setSt(e.target.value as ShopStatus | '')}><option value="">Все статусы</option>{(Object.keys(STATUS) as ShopStatus[]).map((s) => <option key={s} value={s}>{STATUS[s]}</option>)}</select></label>
        </div>
      </Panel>
      <div className="mt-5 overflow-x-auto">
        {!list ? <p className="text-muted">Загружаем…</p> : (
          <table className="table-x min-w-[860px]">
            <thead><tr><th>Магазин</th><th>Контакт</th><th>Регион</th><th>Товары</th><th>Заказы</th><th>Статус</th><th>Подключён</th><th>Действия</th></tr></thead>
            <tbody>{shown.map((s) => (
              <tr key={s.id} className={cn(sel?.id === s.id && 'bg-pink/60')}>
                <td className="font-semibold">{s.name}</td><td>{s.contact_name || '—'}<span className="block text-xs text-muted">вход: {s.login_phone || '—'}</span></td>
                <td>{meta.regions[s.region].name}</td><td>{s.published} / {s.products}{s.in_review > 0 && <span className="block text-xs text-accent">{s.in_review} на проверке</span>}</td>
                <td>{s.orders}</td><td>{s.status_title}</td><td className="whitespace-nowrap">{s.created_at ? new Date(s.created_at).toLocaleDateString('ru-RU') : '—'}</td>
                <td><button type="button" className="text-accent" onClick={() => { setSel(s); setNext(s.status === 'active' ? 'blocked' : 'active'); setChecked(false); }}>Проверка / статус</button></td>
              </tr>
            ))}{!shown.length && <tr><td colSpan={8} className="text-muted">{list.length ? 'Ничего не найдено' : 'Магазинов пока нет — подключите первого поставщика.'}</td></tr>}</tbody>
          </table>
        )}
      </div>
      {sel && (
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
          <Panel title={`Проверка · ${sel.name}`}>
            <p className="text-sm">{sel.description || 'Описание магазина не заполнено.'}</p>
            <div className="mt-3 space-y-1 text-[13px] text-muted">
              <p>Контакт: {sel.contact_name || '—'} · {sel.phone || '—'} · {sel.email || '—'}</p>
              <p>Изготовление и хранение: {sel.storage || 'не указано'}</p>
              <p>Товары: опубликовано {sel.published}, на проверке {sel.in_review}, всего {sel.products}. Заказов: {sel.orders}.</p>
            </div>
            {sel.in_review > 0 && <a className="mt-4 inline-block text-[13px] text-accent" href="/admin/products">Перейти к товарам на проверке</a>}
          </Panel>
          <Panel title="Сменить статус продавца?">
            <span className="pill">Подтверждение ручного действия</span>
            <label className="field mt-4"><span className="label">Новый статус</span><select className="select" value={next} onChange={(e) => setNext(e.target.value as ShopStatus)}>{(Object.keys(STATUS) as ShopStatus[]).map((s) => <option key={s} value={s}>{STATUS[s]}</option>)}</select></label>
            <p className="mt-3 text-[13px] text-muted">«Приостановлен» и «На проверке» снимают все товары магазина с витрины. После активации товары нужно опубликовать заново.</p>
            <label className="check mt-4"><input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />Я проверил данные и понимаю последствия</label>
            <div className="mt-5 flex flex-wrap gap-3"><button type="button" className="btn btn-primary" disabled={!checked || next === sel.status} onClick={changeStatus}>Подтвердить смену статуса</button><button type="button" className="btn" onClick={() => setSel(null)}>Отмена</button></div>
          </Panel>
        </div>
      )}
      <Info className="mt-6 text-[13px]">Поставщик входит в кабинет по адресу /seller/login с выданными телефоном и паролем и видит только свои товары и заказы.</Info>
    </>
  );
}
