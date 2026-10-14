'use client';
import { useRef, useState, type FormEvent } from 'react';
import { useAddresses } from '@/features/account/data';
import { AccountHead } from '@/features/account/page';
import { Card, Info } from '@/features/account/parts';
import { useShop } from '@/features/shop/store';
import { del, post, put } from '@/shared/api/client';
import type { Address, RegionId } from '@/shared/api/types';
import { cn } from '@/shared/lib/format';

type Form = Omit<Address, 'id'>;

export default function AccountAddresses() {
  const { user, meta, toast } = useShop();
  const [list, reload] = useAddresses();
  const blank = (): Form => ({ title: '', name: user?.name || '', region: user?.region || 'DNR', city: '', line: '', phone: user?.phone || '', is_default: false });
  const [form, setForm] = useState<Form>(blank);
  const [editing, setEditing] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const f = <K extends keyof Form>(k: K, v: Form[K]) => setForm((x) => ({ ...x, [k]: v }));

  const reset = () => { setForm(blank()); setEditing(null); setErr(''); };
  const edit = (a: Address) => {
    const { id, ...rest } = a;
    setForm(rest); setEditing(id); setErr('');
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.city.trim() || !form.line.trim() || form.phone.replace(/\D/g, '').length < 10) {
      setErr('Заполните обязательные поля: получатель, город, адрес и телефон полностью.'); return;
    }
    setBusy(true);
    try {
      await (editing ? put(`/api/account/addresses/${editing}`, form) : post('/api/account/addresses', form));
      toast(editing ? 'Адрес сохранён' : 'Адрес добавлен'); reset(); reload();
    } catch (ex) { setErr((ex as Error).message); }
    finally { setBusy(false); }
  };
  const remove = async (a: Address) => {
    if (!confirm(`Удалить адрес «${a.title}»?`)) return;
    try { await del(`/api/account/addresses/${a.id}`); toast('Адрес удалён'); if (editing === a.id) reset(); reload(); }
    catch (ex) { toast((ex as Error).message); }
  };
  const makeDefault = async (a: Address) => {
    try { await post(`/api/account/addresses/${a.id}/default`); toast('Основной адрес изменён'); reload(); }
    catch (ex) { toast((ex as Error).message); }
  };
  const inp = (k: keyof Form) => cn('input', err && !String(form[k]).trim() && k !== 'title' && 'input-invalid');

  return (
    <>
      <AccountHead title="Мои адреса" />
      <Info>Сохранённые адреса подставляются при оформлении заказа. Возможность доставки до двери уточняется для каждой партии.</Info>
      {!list ? <p className="mt-6 text-muted">Загружаем…</p> : list.length > 0 && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {list.map((a) => (
            <Card key={a.id} title={a.title}>
              <span className={cn('pill', !a.is_default && 'pill-soft')}>{a.is_default ? 'Основной адрес' : 'Дополнительный адрес'}</span>
              <p className="mt-4 font-semibold">{a.name}</p>
              <p className="mt-3 text-[15px]">{meta.regions[a.region].name} · {a.city}, {a.line}</p>
              <p className="mt-3 text-[15px] text-muted">{a.phone}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button type="button" className="btn btn-primary" onClick={() => edit(a)}>Редактировать</button>
                {a.is_default
                  ? <button type="button" className="btn" onClick={() => remove(a)}>Удалить</button>
                  : <>
                      <button type="button" className="btn" onClick={() => makeDefault(a)}>Сделать основным</button>
                      <button type="button" className="btn btn-ghost" onClick={() => remove(a)}>Удалить</button>
                    </>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <form ref={formRef} onSubmit={submit} noValidate className="mt-6 scroll-mt-32 rounded-card border border-line p-6">
        <h2 className="h3 mb-5">{editing ? 'Изменение адреса' : 'Добавление адреса'}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field"><span className="label">Название адреса</span><input className="input" placeholder="Дом, работа, для подарков" value={form.title} onChange={(e) => f('title', e.target.value)} /></label>
          <label className="field"><span className="label">Имя получателя *</span><input className={inp('name')} autoComplete="name" value={form.name} onChange={(e) => f('name', e.target.value)} /></label>
          <label className="field"><span className="label">Регион *</span>
            <select className="select" value={form.region} onChange={(e) => f('region', e.target.value as RegionId)}>
              {(Object.keys(meta.regions) as RegionId[]).map((r) => <option key={r} value={r}>{meta.regions[r].name}</option>)}
            </select></label>
          <label className="field"><span className="label">Город *</span><input className={inp('city')} autoComplete="address-level2" placeholder={meta.regions[form.region].city} value={form.city} onChange={(e) => f('city', e.target.value)} /></label>
          <label className="field sm:col-span-2"><span className="label">Улица, дом, квартира *</span><input className={inp('line')} autoComplete="street-address" value={form.line} onChange={(e) => f('line', e.target.value)} /></label>
          <label className="field sm:col-span-2"><span className="label">Телефон *</span><input className={inp('phone')} type="tel" autoComplete="tel" placeholder="+7 (___) ___-__-__" value={form.phone} onChange={(e) => f('phone', e.target.value)} /></label>
        </div>
        <label className="check mt-5"><input type="checkbox" checked={form.is_default} onChange={(e) => f('is_default', e.target.checked)} />Использовать по умолчанию</label>
        {err && <p role="alert" className="mt-4 text-[13px] text-accent">{err}</p>}
        <div className="mt-6 flex flex-wrap gap-3">
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Сохраняем…' : editing ? 'Сохранить адрес' : 'Добавить адрес'}</button>
          <button type="button" className="btn" onClick={reset}>Отмена</button>
        </div>
      </form>
    </>
  );
}
