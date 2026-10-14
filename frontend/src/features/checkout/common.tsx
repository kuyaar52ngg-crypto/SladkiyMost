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

/** Приём заказов приостановлен или сумма меньше минимальной (настройки площадки). null — можно оформлять. */
export function useOrderBlock(items: CartItem[]): string | null {
  const { meta } = useShop();
  const r = meta.rules;
  if (!r.orders_open) return r.orders_closed_message;
  if (r.min_order_rub > 0 && goods(items) < r.min_order_rub) return `Минимальная сумма заказа — ${rub(r.min_order_rub)}. Добавьте ещё сладостей на ${rub(r.min_order_rub - goods(items))}.`;
  return null;
}

export const OrderBlock = ({ text }: { text: string | null }) => text
  ? <div role="alert" className="mb-5 rounded-card border-l-4 border-accent bg-pink px-4 py-3 text-[13px]"><b className="block text-accent">Оформление недоступно</b>{text}</div>
  : null;
