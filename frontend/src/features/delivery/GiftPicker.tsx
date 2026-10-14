'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { other, useShop } from '@/features/shop/store';
import type { Product, RegionId } from '@/shared/api/types';
import { cn } from '@/shared/lib/format';
import { Icon } from '@/shared/ui';
import { ProductCard } from '@/widgets/ProductCard';

export function GiftPicker({ products, initialTo }: { products: Product[]; initialTo: RegionId | null }) {
  const { meta, draft, setDraft, ready } = useShop();
  const router = useRouter();
  const [to, setTo] = useState<RegionId | null>(initialTo);
  useEffect(() => { if (ready && !to && draft.gift && draft.origin) setTo(other(draft.origin)); }, [ready, to, draft]);
  const origin = to ? other(to) : null;
  const choose = (r: RegionId) => { setTo(r); setDraft({ gift: true, origin: other(r), wave_id: null }); };
  const list = origin ? products.filter((p) => p.region === origin).sort((a, b) => Number(b.category === 'Подарочные наборы') - Number(a.category === 'Подарочные наборы')) : [];
  const options: [RegionId, string, string][] = [
    ['DNR', 'В Донбассе', 'Отправим сладости Якутии — вкус Севера для близких в Донецке и области'],
    ['YKT', 'В Якутии', 'Отправим сладости Донбасса — тепло юга для близких в Якутске'],
  ];
  return (
    <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_340px]">
      <div>
        <div className="card">
          <h3 className="h3 mb-4">1. Где живёт получатель?</h3>
          <div className="space-y-2.5">
            {options.map(([r, t, s]) => (
              <label key={r} className={cn('flex cursor-pointer gap-3 rounded-card border p-4', to === r ? 'border-accent bg-pink' : 'border-line')}>
                <input type="radio" name="to" className="mt-0.5 size-[18px] accent-accent" checked={to === r} onChange={() => choose(r)} />
                <div><b>{t}</b><p className="mt-1.5 text-[13px] text-muted">{s}</p></div>
              </label>
            ))}
          </div>
        </div>
        {origin && (
          <div className="mt-6">
            <h2 className="h2 mb-5 text-2xl">2. Выберите сладости {meta.regions[origin].gen}</h2>
            <div className="grid grid-cols-2 gap-x-3 gap-y-5 lg:grid-cols-3 lg:gap-x-4.5">{list.map((p) => <ProductCard key={p.id} p={p} />)}</div>
          </div>
        )}
      </div>
      <aside className="flex flex-col gap-4 lg:sticky lg:top-32">
        <div className="card-pink"><h3 className="h3 mb-3">Как это работает</h3>
          <ol className="space-y-2 text-[13px]">{['Выберите регион получателя', 'Добавьте сладости в корзину', 'Выберите волну и напишите открытку', 'Отслеживайте путь подарка'].map((t, i) => <li key={t} className="flex gap-3"><b className="text-accent">{i + 1}</b>{t}</li>)}</ol>
        </div>
        {origin && <button className="btn btn-primary w-full" onClick={() => router.push('/cart')}>Перейти к оформлению <Icon name="arrow" className="size-4" /></button>}
      </aside>
    </div>
  );
}
