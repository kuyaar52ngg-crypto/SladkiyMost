'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cartFor, goods, netKg, useShop, type CartItem } from '@/features/shop/store';
import { kg, rub } from '@/shared/lib/format';
import { Empty, Kv } from '@/shared/ui';

export function Summary({ items, children }: { items: CartItem[]; children?: ReactNode }) {
  return (
    <>
      <Kv k={`Товары · ${items.reduce((s, i) => s + i.qty, 0)} шт.`} v={rub(goods(items))} />
      <Kv k="Вес товаров (нетто)" v={kg(netKg(items))} />
      {children}
    </>
  );
}

/** Позиции корзины для текущей отправки; null — пока состояние не загружено или корзина пуста. */
export function useCheckoutItems() {
  const { ready, draft, cart } = useShop();
  const items = cartFor(cart, draft.origin);
  return { ready, items: draft.origin ? items : [], origin: draft.origin || null };
}

export function NeedItems() {
  return <div className="container-x py-10"><Empty title="Сначала выберите сладости" text="Корзина для этой отправки пуста."><Link className="btn btn-primary" href="/cart">В корзину</Link></Empty></div>;
}

export const Loading = () => <div className="container-x py-24 text-center text-muted">Загружаем…</div>;

export const Layout = ({ main, aside }: { main: ReactNode; aside: ReactNode }) => (
  <div className="grid items-start gap-8 lg:grid-cols-[1fr_340px]">
    <div className="min-w-0">{main}</div>
    <aside className="flex flex-col gap-4 lg:sticky lg:top-32">{aside}</aside>
  </div>
);
