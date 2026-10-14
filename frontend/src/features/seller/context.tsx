'use client';
import { createContext, useContext } from 'react';
import type { Shop } from '@/shared/api/types';

/** Магазин текущего поставщика (загружается в layout кабинета). */
export const ShopCtx = createContext<{ shop: Shop; setShop: (s: Shop) => void } | null>(null);

export function useSellerShop() {
  const c = useContext(ShopCtx);
  if (!c) throw new Error('useSellerShop вне кабинета поставщика');
  return c;
}

export const PREP_NEXT: Record<string, [string, string] | undefined> = {
  new: ['confirmed', 'Подтвердить наличие'],
  confirmed: ['preparing', 'Начать подготовку'],
  preparing: ['ready', 'Готов к передаче'],
  ready: ['handed', 'Передать в доставку'],
};
