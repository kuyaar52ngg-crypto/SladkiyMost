'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { other, useShop } from '@/features/shop/store';
import type { Product, RegionId } from '@/shared/api/types';
import { cn, plural } from '@/shared/lib/format';
import { Icon, Note } from '@/shared/ui';
import { ProductCard } from '@/widgets/ProductCard';

interface Filters { region: string[]; category: string[]; q: string; min: string; max: string; sort: string }

const split = (v?: string) => (v ? v.split(',').filter(Boolean) : []);

export function CatalogView({ products, popularOrder, initial }: { products: Product[]; popularOrder: string[]; initial: Record<string, string | undefined> }) {
  const { meta, draft } = useShop();
  const router = useRouter();
  const search = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<Filters>({
    region: split(initial.region), category: split(initial.category), q: initial.q || '',
    min: initial.min || '', max: initial.max || '', sort: initial.sort || '',
  });

  useEffect(() => { if (initial.focus) search.current?.focus(); }, [initial.focus]);
  useEffect(() => {
    const p = new URLSearchParams();
    if (f.region.length) p.set('region', f.region.join(','));
    if (f.category.length) p.set('category', f.category.join(','));
    if (f.q) p.set('q', f.q);
    if (f.min) p.set('min', f.min);
    if (f.max) p.set('max', f.max);
    if (f.sort) p.set('sort', f.sort);
    const qs = p.toString();
    router.replace(`/catalog${qs ? '?' + qs : ''}`, { scroll: false });
  }, [f, router]);

  const list = useMemo(() => {
    const s = f.q.trim().toLowerCase();
    const min = Number(f.min) || 0, max = Number(f.max) || Infinity;
    const out = products.filter((p) => (!f.region.length || f.region.includes(p.region)) && (!f.category.length || f.category.includes(p.category))
      && p.price_rub >= min && p.price_rub <= max && (!s || `${p.name} ${p.description} ${p.category}`.toLowerCase().includes(s)));
    if (f.sort === 'price_asc') out.sort((a, b) => a.price_rub - b.price_rub);
    if (f.sort === 'price_desc') out.sort((a, b) => b.price_rub - a.price_rub);
    if (f.sort === 'popular') out.sort((a, b) => popularOrder.indexOf(a.id) - popularOrder.indexOf(b.id));
    return out;
  }, [products, popularOrder, f]);

  const toggle = (key: 'region' | 'category', v: string) =>
    setF((x) => ({ ...x, [key]: x[key].includes(v) ? x[key].filter((i) => i !== v) : [...x[key], v] }));
  const reset = () => setF({ region: [], category: [], q: '', min: '', max: '', sort: '' });
  const only = (patch: Partial<Filters>) => setF({ region: [], category: [], q: '', min: '', max: '', sort: f.sort, ...patch });
  const prices = products.map((p) => p.price_rub);
  const giftTo = draft.gift && draft.origin ? other(draft.origin as RegionId) : null;

  const tabs: [string, Partial<Filters>, boolean][] = [
    ['Все сладости', {}, !f.region.length && !f.category.length],
    ['Сладости Якутии', { region: ['YKT'] }, f.region.join() === 'YKT' && !f.category.length],
    ['Сладости Донбасса', { region: ['DNR'] }, f.region.join() === 'DNR' && !f.category.length],
    ['Подарочные наборы', { category: ['Подарочные наборы'] }, f.category.join() === 'Подарочные наборы' && !f.region.length],
  ];

  return (
    <>
      {giftTo && <Note className="mb-5">Собираете подарок получателю в <b>{meta.regions[giftTo].name}</b>: подойдут сладости {meta.regions[draft.origin as RegionId].gen}. <Link className="text-accent" href="/cart">Перейти в корзину →</Link></Note>}
      <div className="mb-7 flex flex-wrap gap-2">
        {tabs.map(([t, patch, on]) => <button key={t} className={cn('chip', on && 'chip-on')} onClick={() => only(patch)}>{t}</button>)}
      </div>
      <div className="grid gap-8 md:grid-cols-[220px_1fr]">
        <aside className={cn('md:block', open ? 'block rounded-card border border-line p-5' : 'hidden')}>
          <h3 className="mb-4.5 font-head text-xl font-semibold">Фильтры</h3>
          <fieldset className="mb-5.5"><legend className="mb-2.5 text-sm font-semibold">Регион</legend>
            {(['YKT', 'DNR'] as const).map((r) => <label key={r} className="check mb-2"><input type="checkbox" checked={f.region.includes(r)} onChange={() => toggle('region', r)} />{meta.regions[r].name}</label>)}
          </fieldset>
          <fieldset className="mb-5.5"><legend className="mb-2.5 text-sm font-semibold">Вид сладостей</legend>
            {meta.categories.map((c) => <label key={c} className="check mb-2"><input type="checkbox" checked={f.category.includes(c)} onChange={() => toggle('category', c)} />{c}</label>)}
          </fieldset>
          <fieldset className="mb-5.5"><legend className="mb-2.5 text-sm font-semibold">Цена, ₽</legend>
            <div className="grid grid-cols-2 gap-2">
              <label className="field"><span className="hint">От</span><input className="input" inputMode="numeric" placeholder={String(Math.min(...prices))} value={f.min} onChange={(e) => setF({ ...f, min: e.target.value.replace(/\D/g, '') })} /></label>
              <label className="field"><span className="hint">До</span><input className="input" inputMode="numeric" placeholder={String(Math.max(...prices))} value={f.max} onChange={(e) => setF({ ...f, max: e.target.value.replace(/\D/g, '') })} /></label>
            </div>
          </fieldset>
          <button className="btn w-full" onClick={reset}>Сбросить фильтры</button>
          <Note className="mt-6">Есть аллергия? Проверьте состав в карточке товара и уточните информацию до заказа.</Note>
        </aside>
        <div>
          <div className="mb-4.5 grid gap-4 sm:grid-cols-[1.4fr_1fr]">
            <label className="field"><span className="label">Поиск по каталогу</span><input ref={search} className="input" type="search" placeholder="Название или любимый вкус" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} /></label>
            <label className="field"><span className="label">Сортировка</span>
              <select className="select" value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value })}>
                <option value="">По умолчанию</option><option value="popular">По популярности</option>
                <option value="price_asc">Сначала дешевле</option><option value="price_desc">Сначала дороже</option>
              </select></label>
          </div>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[13px] text-muted">Показано {list.length} {plural(list.length, 'сладость', 'сладости', 'сладостей')}</p>
            <button className="btn btn-sm md:hidden" onClick={() => setOpen(!open)}><Icon name="filter" className="size-4" />Фильтры</button>
          </div>
          {list.length ? (
            <div className="grid grid-cols-2 gap-x-3 gap-y-5 lg:grid-cols-3 lg:gap-x-4.5 lg:gap-y-6">{list.map((p) => <ProductCard key={p.id} p={p} />)}</div>
          ) : (
            <div className="py-14 text-center"><h3 className="h3 mb-2.5">Ничего не нашлось</h3><p className="text-muted">Попробуйте изменить фильтры или поисковый запрос.</p><button className="btn mt-4" onClick={reset}>Сбросить фильтры</button></div>
          )}
          <Note className="mt-8">Ассортимент, цены и фотографии — пример для MVP. Фактическое наличие, состав и сроки годности подтверждаются перед оплатой.</Note>
        </div>
      </div>
    </>
  );
}
