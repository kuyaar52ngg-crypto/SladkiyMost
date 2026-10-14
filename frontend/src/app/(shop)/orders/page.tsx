'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { OrderCard } from '@/features/orders/OrderCard';
import { useShop } from '@/features/shop/store';
import { get } from '@/shared/api/client';
import type { Order } from '@/shared/api/types';
import { cn } from '@/shared/lib/format';
import { Crumbs, Empty, Icon, PageHead } from '@/shared/ui';

const ACTIVE = ['accepted', 'assembling', 'transit', 'pickup'];

export default function OrdersPage() {
  const { ready, profile, setProfile } = useShop();
  const router = useRouter();
  const [list, setList] = useState<Order[] | null>(null);
  const [f, setF] = useState<'all' | 'active' | 'done'>('all');
  useEffect(() => {
    if (!ready) return;
    if (!profile) { router.replace('/login?next=/orders'); return; }
    get<Order[]>(`/api/orders?phone=${encodeURIComponent(profile.phone)}`).then(setList);
  }, [ready, profile, router]);
  if (!list || !profile) return <div className="container-x py-24 text-center text-muted">Загружаем…</div>;
  const shown = list.filter((o) => f === 'all' || (f === 'active') === ACTIVE.includes(o.status));
  const chips: [typeof f, string, number][] = [['all', 'Все', list.length], ['active', 'Активные', list.filter((o) => ACTIVE.includes(o.status)).length], ['done', 'Завершённые', list.filter((o) => !ACTIVE.includes(o.status)).length]];
  return (
    <div className="container-x pt-7 pb-20">
      <Crumbs items={[['Главная', '/'], ['Личный кабинет'], ['Мои заказы']]} />
      <PageHead title="Мои заказы" text="Ваши сладости в пути — все детали и статусы в одном месте." />
      <div className="grid items-start gap-8 md:grid-cols-[220px_1fr]">
        <aside>
          <div className="card-soft"><Icon name="user" /><p className="mt-2 font-semibold">{profile.name}</p><p className="text-[13px] text-muted">{profile.phone}</p></div>
          <nav className="mt-4 text-sm [&_a]:block [&_a]:rounded-lg [&_a]:px-3 [&_a]:py-2.5">
            <Link href="/orders" className="bg-accent/5 text-accent">Мои заказы</Link><Link href="/favorites">Избранное</Link><Link href="/catalog">Каталог</Link>
            <button className="w-full rounded-lg px-3 py-2.5 text-left" onClick={() => { setProfile(null); router.push('/login'); }}>Выйти</button>
          </nav>
        </aside>
        <div>
          <div className="mb-4 flex flex-wrap gap-2">{chips.map(([k, t, n]) => <button key={k} className={cn('chip', f === k && 'chip-on')} onClick={() => setF(k)}>{t} · {n}</button>)}</div>
          {shown.length ? <div className="space-y-4">{shown.map((o) => <OrderCard key={o.code} o={o} />)}</div>
            : <Empty title="Заказов пока нет" text={`Здесь появятся заказы, оформленные на номер ${profile.phone}.`}><Link className="btn btn-primary" href="/catalog">Выбрать сладости</Link></Empty>}
        </div>
      </div>
    </div>
  );
}
