'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useShop } from '@/features/shop/store';
import type { Product } from '@/shared/api/types';
import { Icon } from '@/shared/ui';

export function ProductActions({ product: p }: { product: Product }) {
  const { add, toast, setDraft } = useShop();
  const router = useRouter();
  const [qty, setQty] = useState(1);
  return (
    <>
      <div className="mt-4 flex gap-3">
        <div className="inline-flex min-h-12 items-center rounded-lg border border-line">
          <button className="h-11 w-9.5 text-lg text-accent" aria-label="Меньше" onClick={() => setQty(Math.max(1, qty - 1))}>−</button>
          <span className="min-w-6.5 text-center font-medium">{qty}</span>
          <button className="h-11 w-9.5 text-lg text-accent" aria-label="Больше" onClick={() => setQty(Math.min(50, qty + 1))}>+</button>
        </div>
        <button className="btn btn-primary grow" onClick={() => { add(p, qty); toast(`Добавлено: ${p.name} × ${qty}`); }}>Добавить в корзину <Icon name="bag" className="size-[18px]" /></button>
      </div>
      <button className="btn mt-3 w-full" onClick={() => { add(p, qty); setDraft({ gift: true, origin: p.region }); router.push('/cart'); }}>
        Добавить в подарок <Icon name="gift" className="size-[18px]" />
      </button>
    </>
  );
}
