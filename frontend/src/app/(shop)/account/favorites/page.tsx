'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useProducts } from '@/features/account/data';
import { FavCard } from '@/features/account/FavCard';
import { AccountHead } from '@/features/account/page';
import { Card, Info } from '@/features/account/parts';
import { useShop } from '@/features/shop/store';
import type { RegionId } from '@/shared/api/types';
import { cn } from '@/shared/lib/format';
import { Icon } from '@/shared/ui';

export default function AccountFavorites() {
  const { favs, ready, meta } = useShop();
  const [products] = useProducts();
  const [region, setRegion] = useState<RegionId | 'all'>('all');
  const all = (products || []).filter((p) => favs.includes(p.id));
  const list = all.filter((p) => region === 'all' || p.region === region);
  const missing = favs.length - all.length;
  return (
    <>
      <AccountHead title="Избранное" />
      {!ready || !products ? <p className="text-muted">Загружаем…</p> : all.length ? (
        <>
          <div className="mb-6 flex flex-wrap gap-2">
            {([['all', `Все · ${all.length}`], ['YKT', `Якутия · ${all.filter((p) => p.region === 'YKT').length}`], ['DNR', `Донбасс · ${all.filter((p) => p.region === 'DNR').length}`]] as const).map(([k, t]) => (
              <button key={k} type="button" className={cn('pill', region !== k && 'pill-soft')} onClick={() => setRegion(k)}>{t}</button>
            ))}
          </div>
          <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">{list.map((p) => <FavCard key={p.id} p={p} />)}</div>
          <Info className="mt-8">Цены и наличие обновляются в каталоге. Сладости {meta.regions.YKT.gen} и {meta.regions.DNR.gen} едут разными сборными партиями.</Info>
          <Link className="btn btn-primary mt-6" href="/catalog">Продолжить покупки</Link>
        </>
      ) : (
        <Card>
          <Icon name="heart" className="size-8 text-accent" />
          <h2 className="h3 mt-5">Здесь будут любимые вкусы</h2>
          <p className="mt-3 text-[15px] text-muted">Отмечайте сладости сердечком в каталоге — они сохранятся здесь, чтобы быстро вернуться к ним.{missing > 0 && ' Часть сохранённых товаров сейчас недоступна.'}</p>
          <Link className="btn btn-primary mt-6" href="/catalog">Перейти к покупкам</Link>
        </Card>
      )}
    </>
  );
}
