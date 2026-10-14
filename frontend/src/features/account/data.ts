'use client';
import { useCallback, useEffect, useState } from 'react';
import { get } from '@/shared/api/client';
import { useLive } from '@/shared/lib/live';
import type { Address, Notice, Order, Product, Ticket } from '@/shared/api/types';

/** Загрузка списка из API кабинета: [данные | null, перезагрузить]. */
function useList<T>(path: string): [T[] | null, () => void] {
  const [data, setData] = useState<T[] | null>(null);
  const load = useCallback(() => { get<T[]>(path).then(setData).catch(() => setData([])); }, [path]);
  useEffect(load, [load]);
  useLive(load);
  return [data, load];
}

export const useOrders = () => useList<Order>('/api/orders');
export const useAddresses = () => useList<Address>('/api/account/addresses');
export const useNotices = () => useList<Notice>('/api/account/notifications');
export const useTickets = () => useList<Ticket>('/api/account/tickets');
export const useProducts = () => useList<Product>('/api/products');
