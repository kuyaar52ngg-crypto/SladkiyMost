'use client';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { AdminHead, Panel } from '@/features/admin/ui';
import { useShop } from '@/features/shop/store';
import { api, del, get, post, put } from '@/shared/api/client';
import type { Category } from '@/shared/api/types';

export default function AdminCategories() {
  const { toast } = useShop();
  const [list, setList] = useState<Category[] | null>(null);
  const [name, setName] = useState('');
  const [edit, setEdit] = useState<{ id: number; name: string } | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { get<Category[]>('/api/admin/categories').then(setList).catch(() => setList([])); }, []);

  const run = async (p: Promise<Category[]>, done?: string) => {
    try { setList(await p); setErr(''); if (done) toast(done); return true; }
    catch (e) { setErr((e as Error).message); return false; }
  };
  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) { setErr('Название — не короче 2 символов'); return; }
    if (await run(post('/api/admin/categories', { name }), 'Категория добавлена')) setName('');
  };
  const rename = async (e: FormEvent) => {
    e.preventDefault();
    if (edit && await run(put(`/api/admin/categories/${edit.id}`, { name: edit.name }), 'Категория переименована')) setEdit(null);
  };
  const remove = (c: Category) => {
    if (window.confirm(`Удалить категорию «${c.name}»?`)) run(del(`/api/admin/categories/${c.id}`), 'Категория удалена');
  };

  return (
    <>
      <AdminHead title="Категории" text="Разделы каталога: фильтр на витрине, выбор при добавлении товара. Порядок здесь — порядок на сайте." />
      <form onSubmit={add} noValidate className="mb-6 flex flex-wrap items-end gap-3">
        <label className="field min-w-64 flex-1 sm:max-w-sm"><span className="label">Новая категория</span><input className="input" maxLength={60} placeholder="Например, Чак-чак и халва" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <button className="btn btn-primary">Добавить</button>
      </form>
      {err && <p role="alert" className="mb-4 rounded-card border-l-4 border-accent bg-pink px-4 py-3 text-[13px]">{err}</p>}
      <Panel>
        {!list ? <p className="text-muted">Загружаем…</p> : (
          <div className="overflow-x-auto">
            <table className="table-x min-w-[720px]">
              <thead><tr><th>Порядок</th><th>Категория</th><th>Товаров</th><th>На витрине</th><th>Действия</th></tr></thead>
              <tbody>{list.map((c, i) => (
                <tr key={c.id}>
                  <td className="whitespace-nowrap">
                    <button type="button" aria-label={`Выше: ${c.name}`} className="px-2 text-lg disabled:opacity-30" disabled={i === 0} onClick={() => run(post(`/api/admin/categories/${c.id}/move`, { delta: -1 }))}>↑</button>
                    <button type="button" aria-label={`Ниже: ${c.name}`} className="px-2 text-lg disabled:opacity-30" disabled={i === list.length - 1} onClick={() => run(post(`/api/admin/categories/${c.id}/move`, { delta: 1 }))}>↓</button>
                  </td>
                  <td>
                    {edit?.id === c.id ? (
                      <form onSubmit={rename} className="flex gap-2">
                        <input aria-label="Название категории" className="input min-h-10 py-1.5" maxLength={60} autoFocus value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
                        <button className="btn btn-sm btn-primary">Сохранить</button><button type="button" className="btn btn-sm" onClick={() => setEdit(null)}>Отмена</button>
                      </form>
                    ) : <span className="font-semibold">{c.name}</span>}
                  </td>
                  <td>{c.products ? <Link className="text-accent" href={`/admin/products?category=${encodeURIComponent(c.name)}`}>{c.products}</Link> : 0}</td>
                  <td><button type="button" role="switch" aria-checked={c.active} aria-label={`Показывать «${c.name}» на витрине`} className="switch"
                    onClick={() => run(api<Category[]>('PUT', `/api/admin/categories/${c.id}`, { active: !c.active }), c.active ? 'Категория скрыта с витрины' : 'Категория снова на витрине')}><span /></button></td>
                  <td className="whitespace-nowrap">
                    <button type="button" className="text-accent" onClick={() => setEdit({ id: c.id, name: c.name })}>Переименовать</button>
                    <button type="button" className="ml-4 text-muted hover:text-accent disabled:opacity-40" disabled={c.products > 0} title={c.products ? 'Сначала перенесите товары или скройте категорию' : undefined} onClick={() => remove(c)}>Удалить</button>
                  </td>
                </tr>
              ))}{!list.length && <tr><td colSpan={5} className="text-muted">Категорий пока нет.</td></tr>}</tbody>
            </table>
          </div>
        )}
        <p className="mt-4 text-xs text-muted">Переименование переносит товары в новое название. Категорию с товарами нельзя удалить — её можно скрыть: товары останутся в каталоге, но пропадёт фильтр.</p>
      </Panel>
    </>
  );
}
