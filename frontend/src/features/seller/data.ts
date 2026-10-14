'use client';
import { useCallback, useEffect, useState } from 'react';
import { get } from '@/shared/api/client';
import { useLive } from '@/shared/lib/live';
import type { PrepStatus, Product, ShopOrder, Wave } from '@/shared/api/types';

function useList<T>(path: string): [T[] | null, () => void] {
  const [data, setData] = useState<T[] | null>(null);
  const load = useCallback(() => { get<T[]>(path).then(setData).catch(() => setData([])); }, [path]);
  useEffect(load, [load]);
  useLive(load);
  return [data, load];
}

export const useShopOrders = () => useList<ShopOrder>('/api/seller/orders');
export const useShopProducts = () => useList<Product>('/api/seller/products');
export const useShopWaves = () => useList<Wave>('/api/seller/waves');

export const IN_WORK: PrepStatus[] = ['confirmed', 'preparing', 'ready'];
export const sellerOrderUrl = (code: string) => `/seller/orders/${encodeURIComponent(code)}`;
export const units = (o: ShopOrder) => o.order.items.reduce((s, i) => s + i.qty, 0);
export const productState = (p: Product) => (p.active ? 'Опубликован' : p.review ? 'На проверке' : 'Черновик');
