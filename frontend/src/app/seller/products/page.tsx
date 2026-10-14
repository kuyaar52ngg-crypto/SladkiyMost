'use client';
import Link from 'next/link';
import { useState } from 'react';
import { AdminHead, Panel } from '@/features/admin/ui';
import { productState, useShopProducts } from '@/features/seller/data';
import { useShop } from '@/features/shop/store';
import { post } from '@/shared/api/client';
import type { Product } from '@/shared/api/types';
import { cn, rub } from '@/shared/lib/format';
import { Icon, Photo } from '@/shared/ui';

export default function SellerProducts() {
  const { toast } = useShop();
  const [list, reload] = useShopProducts();
  const [q, setQ] = useState('');
  const [st, setSt] = useState('');
  const shown = (list || []).filter((p) => (!st || productState(p) === st) && (!q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase())));
  const count = (s: string) => (list || []).filter((p) => productState(p) === s).length;
  const unpublish = async (p: Product) => {
    if (!confirm(`Снять «${p.name}» с публикации?`)) return;
    try { await post(`/api/seller/products/${p.id}/unpublish`); toast('Товар снят с публикации'); reload(); } catch (e) { toast((e as Error).message); }
  };
  return (
    <>
      <AdminHead title="Товары" crumb={[['Кабинет поставщика', '/seller'], ['Товары']]} text="Новые товары появляются на витрине после проверки администратором.">
        <Link className="btn btn-primary" href="/seller/products/new"><Icon name="box" className="size-4" />Добавить товар</Link>
      </AdminHead>
      <Panel>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="field"><span className="label">Поиск по товарам</span><input className="input" placeholder="Название товара" value={q} onChange={(e) => setQ(e.target.value)} /></label>
          <label className="field"><span className="label">Статус</span><select className="select" value={st} onChange={(e) => setSt(e.target.value)}><option value="">Все статусы</option>{['Опубликован', 'На проверке', 'Черновик'].map((s) => <option key={s}>{s}</option>)}</select></label>
        </div>
      </Panel>
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" className={cn('pill', st && 'pill-soft')} onClick={() => setSt('')}>Все · {list?.length ?? 0}</button>
        {['Опубликован', 'На проверке', 'Черновик'].map((s) => <button key={s} type="button" className={cn('pill', st !== s && 'pill-soft')} onClick={() => setSt(s)}>{s} · {count(s)}</button>)}
      </div>
      <div className="mt-4 overflow-x-auto">
        {!list ? <p className="text-muted">Загружаем…</p> : (
          <table className="table-x min-w-[720px]">
            <thead><tr><th>Фото / название</th><th>Категория / цена</th><th>Публикация</th><th>Действия</th></tr></thead>
            <tbody>{shown.map((p) => (
              <tr key={p.id}>
                <td><div className="flex items-center gap-3"><div className="relative size-12 shrink-0 overflow-hidden rounded-md bg-soft"><Photo src={p.photo} alt="" sizes="48px" /></div>
                  <div><b className="text-sm">{p.name}</b><span className="block text-xs text-muted">{p.id} · {p.weight_g} г</span></div></div></td>
                <td>{p.category}<b className="block">{rub(p.price_rub)}</b></td>
                <td><span className={cn('pill', p.active ? 'pill-soft' : p.review ? '' : 'pill-fill')}>{productState(p)}</span></td>
                <td><div className="flex flex-wrap gap-x-3 gap-y-1 text-[13px]"><Link className="text-accent" href={`/seller/products/${p.id}`}>Редактировать</Link>
                  {p.active && <button type="button" className="text-muted hover:text-accent" onClick={() => unpublish(p)}>Снять с публикации</button>}</div></td>
              </tr>
            ))}{!shown.length && <tr><td colSpan={4} className="text-muted">{list.length ? 'Товаров не найдено' : 'Добавьте первый товар магазина.'}</td></tr>}</tbody>
          </table>
        )}
      </div>
    </>
  );
}
