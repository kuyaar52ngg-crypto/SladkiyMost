'use client';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Info } from '@/features/account/parts';
import { AdminHead, Panel } from '@/features/admin/ui';
import { useSellerShop } from '@/features/seller/context';
import { productState } from '@/features/seller/data';
import { useShop } from '@/features/shop/store';
import { ImageUploader } from '@/features/upload/ImageUploader';
import { get, post, put } from '@/shared/api/client';
import type { Product } from '@/shared/api/types';
import { cn, rub } from '@/shared/lib/format';
import { Icon, Photo } from '@/shared/ui';

type Draft = Pick<Product, 'name' | 'manufacturer' | 'category' | 'weight_g' | 'price_rub' | 'temp_sensitive' | 'shelf_life_days' | 'photos' | 'description' | 'composition' | 'tag'>;

export default function SellerProduct() {
  const id = useParams<{ id: string }>().id;
  const isNew = id === 'new';
  const { shop } = useSellerShop();
  const { meta, toast } = useShop();
  const router = useRouter();
  const [p, setP] = useState<Product | null>(null);
  const [d, setD] = useState<Draft>({ name: '', manufacturer: '', category: meta.categories[0], weight_g: 200, price_rub: 300, temp_sensitive: false, shelf_life_days: 30, photos: [], description: '', composition: '', tag: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (isNew) return;
    get<Product[]>('/api/seller/products').then((l) => {
      const x = l.find((y) => y.id === id);
      if (!x) { router.replace('/seller/products'); return; }
      setP(x);
      setD({ name: x.name, manufacturer: x.manufacturer, category: x.category, weight_g: x.weight_g, price_rub: x.price_rub, temp_sensitive: x.temp_sensitive, shelf_life_days: x.shelf_life_days, photos: x.photos.length ? x.photos : [x.photo], description: x.description, composition: x.composition, tag: x.tag });
    });
  }, [id, isNew, router]);
  const f = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const checks: [string, boolean][] = [['Название и категория', !!d.name.trim()], ['Фото и цена', d.photos.length > 0 && d.price_rub > 0], ['Вес и срок годности', d.weight_g > 0 && d.shelf_life_days > 0], ['Описание', d.description.trim().length >= 20], ['Состав и аллергены', d.composition.trim().length >= 10]];

  const save = async (submit: boolean) => {
    if (!d.name.trim()) { setErr('Укажите название'); return; }
    if (!d.photos.length) { setErr('Добавьте хотя бы одно фото'); return; }
    if (submit && checks.some(([, ok]) => !ok)) { setErr('Для публикации заполните все пункты проверки: описание (от 20 знаков) и состав.'); return; }
    setBusy(true); setErr('');
    try {
      const body = { ...d, region: shop.region, submit };
      const r = await (isNew ? post<Product>('/api/seller/products', body) : put<Product>(`/api/seller/products/${id}`, body));
      toast(submit ? 'Товар отправлен на проверку' : 'Черновик сохранён');
      router.replace(isNew ? `/seller/products/${r.id}` : '/seller/products');
      if (!isNew) setP(r);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };
  const submit = (e: FormEvent) => { e.preventDefault(); save(!p?.active); };

  return (
    <>
      <AdminHead title={isNew ? 'Добавление товара' : 'Редактирование товара'} crumb={[['Кабинет поставщика', '/seller'], ['Товары', '/seller/products'], [isNew ? 'Новый товар' : d.name || id]]}>
        {p && <span className={cn('pill', p.active ? 'pill-soft' : '')}>{productState(p)}</span>}
      </AdminHead>
      <form onSubmit={submit} noValidate className="grid items-start gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <Panel title="Основная информация">
            <div className="space-y-4">
              <label className="field"><span className="label">Название *</span><input className="input" value={d.name} onChange={(e) => f('name', e.target.value)} /></label>
              <label className="field"><span className="label">Описание</span><textarea className="input min-h-24" value={d.description} onChange={(e) => f('description', e.target.value)} placeholder="Вкус, повод, чем особенный" /></label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="field"><span className="label">Категория *</span><select className="select" value={d.category} onChange={(e) => f('category', e.target.value)}>{[...meta.categories, ...(meta.categories.includes(d.category) ? [] : [d.category])].map((c) => <option key={c}>{c}</option>)}</select></label>
                <label className="field"><span className="label">Регион производства</span><input className="input bg-soft" readOnly value={meta.regions[shop.region].name} /></label>
              </div>
              <label className="field"><span className="label">Производитель</span><input className="input" placeholder={shop.name} value={d.manufacturer} onChange={(e) => f('manufacturer', e.target.value)} /></label>
            </div>
          </Panel>
          <Panel title="Фотографии"><ImageUploader value={d.photos} onChange={(v) => f('photos', v)} endpoint="/api/seller/uploads" /></Panel>
          <Panel title="Цена и вес">
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="field"><span className="label">Цена за упаковку, ₽ *</span><input className="input" type="number" min={1} value={d.price_rub} onChange={(e) => f('price_rub', Number(e.target.value))} /></label>
              <label className="field"><span className="label">Масса нетто, г *</span><input className="input" type="number" min={1} value={d.weight_g} onChange={(e) => f('weight_g', Number(e.target.value))} /></label>
              <label className="field"><span className="label">Метка</span><input className="input" placeholder="Новинка, Хит" value={d.tag} onChange={(e) => f('tag', e.target.value)} /></label>
            </div>
          </Panel>
          <Panel title="Состав и аллергены">
            <label className="field"><span className="label">Состав *</span><textarea className="input min-h-24" value={d.composition} onChange={(e) => f('composition', e.target.value)} placeholder="Состав и аллергены — как на упаковке" /></label>
            <Info className="mt-4 text-[13px]">Проверьте данные по упаковке: покупатели с аллергией опираются на этот текст.</Info>
          </Panel>
          <Panel title="Хранение">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="field"><span className="label">Срок годности, сут *</span><input className="input" type="number" min={1} value={d.shelf_life_days} onChange={(e) => f('shelf_life_days', Number(e.target.value))} /></label>
            </div>
            <label className="check mt-4"><input type="checkbox" checked={d.temp_sensitive} onChange={(e) => f('temp_sensitive', e.target.checked)} />Чувствителен к температуре (шоколад) — нужна термоупаковка</label>
          </Panel>
          {err && <p role="alert" className="rounded-card bg-pink px-4 py-3 text-[13px] text-accent">{err}</p>}
          <div className="flex flex-wrap gap-3">
            {!p?.active && <button type="button" className="btn btn-primary" disabled={busy} onClick={() => save(false)}>Сохранить черновик</button>}
            <button className={cn('btn', p?.active && 'btn-primary')} disabled={busy}>{p?.active ? 'Сохранить изменения' : 'Отправить на публикацию'}</button>
            <button type="button" className="btn btn-ghost" onClick={() => router.push('/seller/products')}>Отмена</button>
          </div>
        </div>
        <aside className="space-y-6 lg:sticky lg:top-6">
          <Panel title="Предпросмотр">
            <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-soft">{d.photos[0] ? <Photo src={d.photos[0]} alt="" sizes="300px" /> : <span className="grid h-full place-items-center text-xs text-muted">Фото появится здесь</span>}</div>
            <p className="mt-3 font-head font-bold">{d.name || 'Название товара'}</p>
            <p className="text-xs text-muted">{meta.regions[shop.region].name} · {d.manufacturer || shop.name}</p>
            <div className="mt-2 flex justify-between text-sm"><span className="text-muted">Масса</span><b>{d.weight_g} г</b></div>
            <b className="mt-2 block font-head text-xl">{rub(d.price_rub)}</b>
          </Panel>
          <Panel title="Проверка заполнения">
            <ul className="space-y-2 text-sm">{checks.map(([t, ok]) => <li key={t} className={cn('flex items-center gap-2', ok ? 'text-ok' : 'text-muted')}><Icon name={ok ? 'check' : 'x'} className="size-4" />{t}</li>)}</ul>
            <p className="mt-3 text-xs text-muted">Публикация — после проверки администратором. Правки опубликованного товара сразу видны покупателям.</p>
          </Panel>
        </aside>
      </form>
    </>
  );
}
