import type { Metadata } from 'next';
import { CatalogView } from '@/features/catalog/CatalogView';
import { get } from '@/shared/api/client';
import type { Product } from '@/shared/api/types';
import { Crumbs, PageHead } from '@/shared/ui';

export const metadata: Metadata = { title: 'Каталог сладостей' };

export default async function CatalogPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [sp, products, popular] = await Promise.all([
    searchParams, get<Product[]>('/api/products'), get<Product[]>('/api/products?sort=popular'),
  ]);
  return (
    <div className="container-x pt-7 pb-20">
      <Crumbs items={[['Главная', '/'], ['Каталог сладостей']]} />
      <PageHead title="Каталог сладостей" text="Вкусы Якутии и Донбасса — выбирайте своё маленькое удовольствие." />
      <CatalogView products={products} popularOrder={popular.map((p) => p.id)} initial={sp} />
    </div>
  );
}
