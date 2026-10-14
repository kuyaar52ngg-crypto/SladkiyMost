'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useShop } from '@/features/shop/store';
import { get } from '@/shared/api/client';
import type { Product } from '@/shared/api/types';
import { Crumbs, Empty, PageHead } from '@/shared/ui';
import { ProductCard } from '@/widgets/ProductCard';

export default function FavoritesPage() {
  const { favs, ready } = useShop();
  const [products, setProducts] = useState<Product[] | null>(null);
  useEffect(() => { get<Product[]>('/api/products').then(setProducts); }, []);
  const list = (products || []).filter((p) => favs.includes(p.id));
  return (
    <div className="container-x pt-7 pb-20">
      <Crumbs items={[['Главная', '/'], ['Избранное']]} />
      <PageHead title="Избранное" text="Сладости, к которым хочется вернуться." />
      {!ready || !products ? <p className="text-muted">Загружаем…</p> : list.length ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-5 md:grid-cols-4 md:gap-x-4.5">{list.map((p) => <ProductCard key={p.id} p={p} />)}</div>
      ) : <Empty title="Здесь пока пусто" text="Нажмите на сердечко в карточке товара, чтобы сохранить его."><Link className="btn btn-primary" href="/catalog">В каталог</Link></Empty>}
    </div>
  );
}
