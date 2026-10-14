'use client';
import Link from 'next/link';
import { useShop } from '@/features/shop/store';
import type { Product } from '@/shared/api/types';
import { rub } from '@/shared/lib/format';
import { Icon, Photo } from '@/shared/ui';

export function ProductCard({ p }: { p: Product }) {
  const { add, toggleFav, favs, cart, toast, meta } = useShop();
  const fav = favs.includes(p.id);
  const inCart = cart.some((i) => i.id === p.id);
  return (
    <article className="group flex flex-col gap-2.5">
      <div className="relative aspect-[282/246] overflow-hidden rounded-card bg-soft">
        <Link href={`/product/${p.id}`} aria-label={p.name} className="absolute inset-0">
          <Photo src={p.photo} alt={p.name} sizes="(max-width: 768px) 50vw, 25vw" className="transition duration-500 group-hover:scale-105" />
        </Link>
        {p.tag && <span className="absolute top-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-[13px] font-medium text-accent">{p.tag}</span>}
        <button aria-label={fav ? 'Убрать из избранного' : 'В избранное'} aria-pressed={fav}
          onClick={() => toast(toggleFav(p.id) ? 'Добавлено в избранное' : 'Убрано из избранного')}
          className={`absolute top-3 right-3 grid size-[34px] place-items-center rounded-full bg-white ${fav ? 'text-accent' : ''}`}>
          <Icon name="heart" className="size-[17px]" filled={fav} />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
        {meta.regions[p.region].name} · {p.weight_g} г
        {p.temp_sensitive && <span className="tag tag-warn"><Icon name="thermo" className="size-3.5" />шоколад</span>}
      </div>
      <Link href={`/product/${p.id}`} className="min-h-10 font-head text-[15px] font-semibold md:min-h-11 md:text-[17px]">{p.name}</Link>
      <div className="mt-auto flex items-center justify-between gap-2 max-sm:flex-col max-sm:items-stretch">
        <span className="text-lg font-semibold whitespace-nowrap md:text-[21px]">{rub(p.price_rub)}</span>
        <button className="btn btn-sm" onClick={() => { add(p); toast('Добавлено в корзину'); }}>
          {inCart ? <><Icon name="check" className="size-4" />В корзине</> : 'В корзину'}
        </button>
      </div>
    </article>
  );
}
