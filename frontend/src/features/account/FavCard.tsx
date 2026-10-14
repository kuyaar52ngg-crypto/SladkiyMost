'use client';
import Link from 'next/link';
import { useShop } from '@/features/shop/store';
import type { Product } from '@/shared/api/types';
import { rub } from '@/shared/lib/format';
import { Icon, Photo } from '@/shared/ui';

/** Карточка сохранённой сладости в кабинете: «В корзину» и «Удалить из избранного». */
export function FavCard({ p }: { p: Product }) {
  const { add, toggleFav, toast, cart, meta } = useShop();
  const inCart = cart.some((i) => i.id === p.id);
  return (
    <article className="flex flex-col">
      <div className="relative aspect-[472/230] overflow-hidden rounded-card bg-soft">
        <Link href={`/product/${p.id}`} aria-label={p.name} className="absolute inset-0"><Photo src={p.photo} alt={p.name} sizes="(max-width: 768px) 100vw, 480px" /></Link>
        <button type="button" aria-label="Убрать из избранного" onClick={() => { toggleFav(p.id); toast('Убрано из избранного'); }}
          className="absolute top-4 right-4 grid size-9 place-items-center rounded-full bg-white/90 text-accent"><Icon name="heart" className="size-5" /></button>
      </div>
      <p className="mt-4 text-[13px] text-muted">{meta.regions[p.region].name} · {p.weight_g} г</p>
      <Link href={`/product/${p.id}`} className="mt-2 min-h-12 font-head text-lg font-bold">{p.name}</Link>
      {p.manufacturer && <p className="text-[13px] text-muted">{p.manufacturer}</p>}
      <b className="mt-3 font-head text-[26px]">{rub(p.price_rub)}</b>
      <button type="button" className="btn mt-3 w-full" onClick={() => { add(p); toast('Добавлено в корзину'); }}>
        {inCart ? <><Icon name="check" className="size-4" />В корзине</> : 'В корзину'}
      </button>
      <button type="button" className="mt-3 self-start text-[13px] text-accent hover:underline" onClick={() => { toggleFav(p.id); toast('Убрано из избранного'); }}>Удалить из избранного</button>
    </article>
  );
}
