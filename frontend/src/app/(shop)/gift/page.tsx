import type { Metadata } from 'next';
import Image from 'next/image';
import { GiftPicker } from '@/features/delivery/GiftPicker';
import { get } from '@/shared/api/client';
import { getMeta } from '@/shared/api/meta';
import type { Product } from '@/shared/api/types';
import { rub } from '@/shared/lib/format';
import { Crumbs, PageHead } from '@/shared/ui';

export const metadata: Metadata = { title: 'Подарочный заказ' };

export default async function GiftPage({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  const [{ to }, meta, products] = await Promise.all([searchParams, getMeta(), get<Product[]>('/api/products')]);
  return (
    <div className="container-x pt-7 pb-20">
      <Crumbs items={[['Главная', '/'], ['Подарочный заказ']]} />
      <PageHead title="Подарочный заказ" text="Соберите тёплое послание из любимых сладостей и ваших слов." />
      <div className="grid overflow-hidden rounded-card bg-pink md:grid-cols-2">
        <div className="relative min-h-[240px]"><Image src="/img/gift.jpg" alt="Подарочная коробка с лентой" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" /></div>
        <div className="flex flex-col items-start justify-center gap-4 px-5 py-7 md:p-12">
          <span className="tag">Подарочная коробка с лентой — {rub(meta.policy.gift_box_price)}</span>
          <h2 className="h2">Подарок, который преодолевает расстояния</h2>
          <p className="text-muted">Получатель — в другом регионе. Добавим открытку с вашими словами, а о вручении договоримся заранее. Можно сделать сюрпризом.</p>
        </div>
      </div>
      <GiftPicker products={products} initialTo={to === 'YKT' || to === 'DNR' ? to : null} />
    </div>
  );
}
