'use client';
// Клиентское состояние магазина: корзина, избранное, профиль, черновик оформления, уведомления.
// Хранится в localStorage; сервер перепроверяет цены и наличие при расчёте и оформлении.
// Аккаунт (user) — из cookie сессии через /api/auth/me.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { EmailLinkRedirect } from '@/features/auth/EmailLinkRedirect';
import { TelegramMiniApp } from '@/features/telegram/TelegramMiniApp';
import { get } from '@/shared/api/client';
import type { Meta, Product, ReceiveMethod, RegionId, User } from '@/shared/api/types';

export type CartItem = Pick<Product, 'id' | 'name' | 'photo' | 'price_rub' | 'weight_g' | 'region' | 'temp_sensitive'> & { qty: number };
/** Контакты последнего оформления — чтобы гость мог открыть свой заказ по телефону. */
export interface Profile { name: string; phone: string }
export interface Draft {
  origin?: RegionId | null; wave_id?: string | null; gift?: boolean; thermo?: boolean;
  receive?: ReceiveMethod; pickup_point?: string;
  gift_message?: string; gift_signature?: string; gift_card?: string; gift_surprise?: boolean;
  recipient_name?: string; recipient_phone?: string; address?: string; b2b?: boolean; company?: string;
}

interface Persisted { cart: CartItem[]; favs: string[]; profile: Profile | null; draft: Draft }
const KEY = 'sm-shop-v2';
const EMPTY: Persisted = { cart: [], favs: [], profile: null, draft: {} };

interface Shop extends Persisted {
  ready: boolean;
  meta: Meta;
  user: User | null | undefined;  // undefined — ещё не проверили сессию
  setUser: (u: User | null) => void;
  refreshUser: () => Promise<User | null>;
  add: (p: Product | CartItem, qty?: number) => void;
  setQty: (id: string, qty: number) => void;
  clearRegion: (r: RegionId) => void;
  toggleFav: (id: string) => boolean;
  setProfile: (p: Profile | null) => void;
  setDraft: (patch: Partial<Draft>) => void;
  toast: (msg: string) => void;
  count: number;
}

const Ctx = createContext<Shop | null>(null);

export function ShopProvider({ meta, children }: { meta: Meta; children: ReactNode }) {
  const [s, setS] = useState<Persisted>(EMPTY);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) setS({ ...EMPTY, ...JSON.parse(raw) }); } catch { /* приватный режим */ }
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* приватный режим */ }
  }, [s, ready]);

  const refreshUser = useCallback(async () => {
    const u = await get<User | null>('/api/auth/me').catch(() => null);
    setUser(u);
    return u;
  }, []);
  useEffect(() => { refreshUser(); }, [refreshUser]);

  const toast = useCallback((m: string) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 2600);
  }, []);

  const value = useMemo<Shop>(() => ({
    ...s, ready, meta, toast, user, setUser, refreshUser,
    count: s.cart.reduce((a, i) => a + i.qty, 0),
    add: (p, qty = 1) => setS((x) => {
      const ex = x.cart.find((i) => i.id === p.id);
      const snap: CartItem = { id: p.id, name: p.name, photo: p.photo, price_rub: p.price_rub, weight_g: p.weight_g, region: p.region, temp_sensitive: p.temp_sensitive, qty };
      return { ...x, cart: ex ? x.cart.map((i) => (i.id === p.id ? { ...i, qty: Math.min(50, i.qty + qty) } : i)) : [...x.cart, snap] };
    }),
    setQty: (id, qty) => setS((x) => ({ ...x, cart: qty <= 0 ? x.cart.filter((i) => i.id !== id) : x.cart.map((i) => (i.id === id ? { ...i, qty: Math.min(50, qty) } : i)) })),
    clearRegion: (r) => setS((x) => ({ ...x, cart: x.cart.filter((i) => i.region !== r) })),
    toggleFav: (id) => {
      const on = !s.favs.includes(id);
      setS((x) => ({ ...x, favs: on ? [...x.favs, id] : x.favs.filter((f) => f !== id) }));
      return on;
    },
    setProfile: (profile) => setS((x) => ({ ...x, profile })),
    setDraft: (patch) => setS((x) => ({ ...x, draft: { ...x.draft, ...patch } })),
  }), [s, ready, meta, toast, user, refreshUser]);

  return (
    <Ctx.Provider value={value}>
      <TelegramMiniApp />
      <EmailLinkRedirect />
      {children}
      {msg && (
        <div role="status" className="fixed bottom-24 left-1/2 z-[200] max-w-[calc(100%-32px)] -translate-x-1/2 rounded-full bg-ink px-5 py-3 text-sm text-white shadow-soft md:bottom-7">
          {msg}
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useShop(): Shop {
  const c = useContext(Ctx);
  if (!c) throw new Error('useShop вне ShopProvider');
  return c;
}

export const cartFor = (cart: CartItem[], r?: RegionId | null) => (r ? cart.filter((i) => i.region === r) : cart);
export const netKg = (items: CartItem[]) => items.reduce((s, i) => s + (i.weight_g * i.qty) / 1000, 0);
export const goods = (items: CartItem[]) => items.reduce((s, i) => s + i.price_rub * i.qty, 0);
export const lines = (items: CartItem[]) => items.map((i) => ({ id: i.id, qty: i.qty }));
export const other = (r: RegionId): RegionId => (r === 'YKT' ? 'DNR' : 'YKT');
