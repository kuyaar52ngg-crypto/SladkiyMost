'use client';
import { useState, type FormEvent } from 'react';
import { Info } from '@/features/account/parts';
import { AdminHead, Panel } from '@/features/admin/ui';
import { useSellerShop } from '@/features/seller/context';
import { useShopProducts } from '@/features/seller/data';
import { useShop } from '@/features/shop/store';
import { ImageUploader } from '@/features/upload/ImageUploader';
import { put } from '@/shared/api/client';
import type { Shop } from '@/shared/api/types';
import { rub } from '@/shared/lib/format';
import { Photo } from '@/shared/ui';

export default function SellerProfile() {
  const { shop, setShop } = useSellerShop();
  const { meta, toast } = useShop();
  const [products] = useShopProducts();
  const [v, setV] = useState({ name: shop.name, description: shop.description, contact_name: shop.contact_name, phone: shop.phone, email: shop.email, photo: shop.photo, storage: shop.storage });
  const [err, setErr] = useState('');
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (v.name.trim().length < 2) { setErr('Укажите название магазина'); return; }
    try { setShop(await put<Shop>('/api/seller/shop', { ...v, region: shop.region })); setErr(''); toast('Профиль магазина сохранён'); }
    catch (ex) { setErr((ex as Error).message); }
  };
  const f = (k: keyof typeof v, x: string) => setV({ ...v, [k]: x });
  return (
    <>
      <AdminHead title="Профиль магазина" crumb={[['Кабинет поставщика', '/seller'], ['Профиль магазина']]} text="Эти данные видит администратор площадки. Регион меняет администратор." />
      <form onSubmit={save} noValidate>
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <Panel title={shop.name}>
            <ImageUploader value={v.photo ? [v.photo] : []} onChange={(l) => f('photo', l.at(-1) || '')} endpoint="/api/seller/uploads" />
            <p className="mt-3 text-[13px] text-muted">{meta.regions[shop.region].name} · статус: {shop.status_title}</p>
          </Panel>
          <Panel title="Информация магазина">
            <div className="space-y-4">
              <label className="field"><span className="label">Название *</span><input className="input" value={v.name} onChange={(e) => f('name', e.target.value)} /></label>
              <label className="field"><span className="label">Описание</span><textarea className="input min-h-24" value={v.description} onChange={(e) => f('description', e.target.value)} /></label>
              <label className="field"><span className="label">Регион</span><input className="input bg-soft" readOnly value={meta.regions[shop.region].name} /></label>
              <label className="field"><span className="label">Контактное лицо</span><input className="input" value={v.contact_name} onChange={(e) => f('contact_name', e.target.value)} /></label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="field"><span className="label">Телефон</span><input className="input" type="tel" value={v.phone} onChange={(e) => f('phone', e.target.value)} /></label>
                <label className="field"><span className="label">Электронная почта</span><input className="input" type="email" value={v.email} onChange={(e) => f('email', e.target.value)} /></label>
              </div>
            </div>
          </Panel>
        </div>
        <Panel className="mt-6" title="Изготовление и хранение">
          <label className="field"><span className="label">Условия</span><textarea className="input min-h-24" placeholder="Как изготавливаете и храните продукцию, сроки подготовки заказа" value={v.storage} onChange={(e) => f('storage', e.target.value)} /></label>
          {err && <p role="alert" className="mt-4 text-[13px] text-accent">{err}</p>}
          <div className="mt-5 flex flex-wrap gap-3"><button className="btn btn-primary">Сохранить изменения</button>
            <button type="button" className="btn" onClick={() => setV({ name: shop.name, description: shop.description, contact_name: shop.contact_name, phone: shop.phone, email: shop.email, photo: shop.photo, storage: shop.storage })}>Отмена</button></div>
        </Panel>
      </form>
      <Panel className="mt-6" title="Товары магазина">
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">{(products || []).filter((p) => p.active).map((p) => (
          <div key={p.id}><div className="relative aspect-[4/3] overflow-hidden rounded-card bg-soft"><Photo src={p.photo} alt={p.name} sizes="300px" /></div>
            <p className="mt-2 font-head font-bold">{p.name}</p><p className="text-sm">{rub(p.price_rub)}</p></div>
        ))}</div>
        {!(products || []).some((p) => p.active) && <p className="text-sm text-muted">Опубликованных товаров пока нет.</p>}
      </Panel>
      <Info className="mt-6 text-[13px]">Покупатели видят товары магазина в общем каталоге «Сладкого моста».</Info>
    </>
  );
}
