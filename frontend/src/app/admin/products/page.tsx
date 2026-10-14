'use client';
import Image from 'next/image';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useShop } from '@/features/shop/store';
import { get, post, put } from '@/shared/api/client';
import type { Product, RegionId } from '@/shared/api/types';
import { rub } from '@/shared/lib/format';
import { Icon } from '@/shared/ui';

const PHOTOS = ['zephyr', 'truffles', 'cookies', 'marmalade', 'wafers', 'cedar', 'gift', 'yakutia', 'hero'];
type Draft = Omit<Product, 'id'> & { id?: string };

export default function ProductsAdmin() {
  const { meta, toast } = useShop();
  const [list, setList] = useState<Product[] | null>(null);
  const [edit, setEdit] = useState<Draft | null>(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => get<Product[]>('/api/admin/products').then(setList), []);
  useEffect(() => { load(); }, [load]);

  const blank: Draft = { name: '', region: 'YKT', manufacturer: '', category: meta.categories[0], weight_g: 200, price_rub: 300, temp_sensitive: false, shelf_life_days: 30, photo: '/img/gift.jpg', description: '', composition: '', tag: '', active: true };
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    const { id, ...body } = edit;
    try {
      await (id ? put(`/api/admin/products/${id}`, body) : post('/api/admin/products', body));
      setEdit(null); setErr(''); toast('Товар сохранён'); load();
    } catch (ex) { setErr((ex as Error).message); }
  };
  const setActive = async (p: Product, active: boolean) => {
    await post(`/api/admin/products/${p.id}/active`, { active });
    toast(active ? 'Товар снова в каталоге' : 'Товар скрыт из каталога'); load();
  };
  if (!list) return <p className="text-muted">Загружаем…</p>;
  const f = <K extends keyof Draft>(k: K, v: Draft[K]) => setEdit((x) => (x ? { ...x, [k]: v } : x));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-muted">{list.filter((p) => p.active).length} активных · {list.length} всего</p>
        <button className="btn btn-primary" onClick={() => setEdit(blank)}><Icon name="box" className="size-4" />Добавить товар</button>
      </div>
      <div className="overflow-x-auto rounded-card border border-line">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-soft text-left text-[13px]"><tr>{['', 'Артикул', 'Название', 'Регион', 'Категория', 'Масса', 'Цена', 'Термо', ''].map((h, i) => <th key={i} className="px-4 py-3.5 font-semibold">{h}</th>)}</tr></thead>
          <tbody>{list.map((p) => (
            <tr key={p.id} className={`border-t border-line [&>td]:px-4 [&>td]:py-3 ${p.active ? '' : 'opacity-50'}`}>
              <td><div className="relative h-10.5 w-12 overflow-hidden rounded-md"><Image src={p.photo} alt="" fill sizes="48px" className="object-cover" /></div></td>
              <td className="text-[13px]">{p.id}</td>
              <td><b className="text-[13px]">{p.name}</b><div className="text-xs text-muted">{p.manufacturer}</div></td>
              <td>{meta.regions[p.region].name}</td><td className="text-[13px]">{p.category}</td>
              <td className="whitespace-nowrap">{p.weight_g} г</td><td className="whitespace-nowrap">{rub(p.price_rub)}</td>
              <td>{p.temp_sensitive ? <span className="tag tag-warn">да</span> : 'нет'}</td>
              <td className="whitespace-nowrap"><button className="btn btn-sm" onClick={() => setEdit(p)}>Изменить</button> <button className="btn btn-sm btn-ghost" onClick={() => setActive(p, !p.active)}>{p.active ? 'Скрыть' : 'Вернуть'}</button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {edit && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-ink/35 p-4" onClick={(e) => e.target === e.currentTarget && setEdit(null)}>
          <form onSubmit={save} role="dialog" aria-modal="true" className="max-h-[90vh] w-full max-w-[640px] space-y-3 overflow-auto rounded-card bg-white p-6">
            <div className="flex items-center justify-between"><h2 className="h2">{edit.id ? 'Изменить товар' : 'Новый товар'}</h2><button type="button" aria-label="Закрыть" onClick={() => setEdit(null)}><Icon name="x" /></button></div>
            <label className="field"><span className="label">Название *</span><input className="input" required value={edit.name} onChange={(e) => f('name', e.target.value)} /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="field"><span className="label">Регион</span><select className="select" value={edit.region} onChange={(e) => f('region', e.target.value as RegionId)}>{Object.entries(meta.regions).map(([k, r]) => <option key={k} value={k}>{r.name}</option>)}</select></label>
              <label className="field"><span className="label">Категория</span><select className="select" value={edit.category} onChange={(e) => f('category', e.target.value)}>{meta.categories.map((c) => <option key={c}>{c}</option>)}</select></label>
            </div>
            <label className="field"><span className="label">Производитель</span><input className="input" value={edit.manufacturer} onChange={(e) => f('manufacturer', e.target.value)} /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="field"><span className="label">Масса нетто, г *</span><input className="input" type="number" min={1} required value={edit.weight_g} onChange={(e) => f('weight_g', Number(e.target.value))} /></label>
              <label className="field"><span className="label">Цена, ₽ *</span><input className="input" type="number" min={1} required value={edit.price_rub} onChange={(e) => f('price_rub', Number(e.target.value))} /></label>
              <label className="field"><span className="label">Срок годности, сут</span><input className="input" type="number" min={1} value={edit.shelf_life_days} onChange={(e) => f('shelf_life_days', Number(e.target.value))} /></label>
              <label className="field"><span className="label">Фото</span><select className="select" value={edit.photo} onChange={(e) => f('photo', e.target.value)}>{PHOTOS.map((x) => <option key={x} value={`/img/${x}.jpg`}>{x}.jpg</option>)}</select></label>
            </div>
            <label className="field"><span className="label">Метка</span><input className="input" placeholder="Например: Хит" value={edit.tag} onChange={(e) => f('tag', e.target.value)} /></label>
            <label className="field"><span className="label">Описание</span><textarea className="input min-h-20" value={edit.description} onChange={(e) => f('description', e.target.value)} /></label>
            <label className="field"><span className="label">Состав</span><textarea className="input min-h-20" value={edit.composition} onChange={(e) => f('composition', e.target.value)} /></label>
            <label className="check"><input type="checkbox" checked={edit.temp_sensitive} onChange={(e) => f('temp_sensitive', e.target.checked)} />Чувствителен к температуре (шоколад)</label>
            {err && <p className="text-xs text-accent">{err}</p>}
            <button className="btn btn-primary w-full">Сохранить</button>
          </form>
        </div>
      )}
    </>
  );
}
