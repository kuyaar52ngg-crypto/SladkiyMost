'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { OrderCard } from '@/features/orders/OrderCard';
import { useShop } from '@/features/shop/store';
import { TelegramConnect } from '@/features/telegram/TelegramConnect';
import { get, post } from '@/shared/api/client';
import type { Order } from '@/shared/api/types';
import { cn } from '@/shared/lib/format';
import { Crumbs, Empty, Icon, PageHead } from '@/shared/ui';

const ACTIVE = ['accepted', 'assembling', 'transit', 'pickup'];

/** Гость: найти заказ по номеру и телефону. */
function GuestLookup() {
  const { profile } = useShop();
  const router = useRouter();
  const [t, setT] = useState({ code: '', phone: profile?.phone || '' });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = t.code.replace(/\D/g, '');
    if (n) router.push(`/orders/${encodeURIComponent('СМ-' + n)}?phone=${encodeURIComponent(t.phone)}`);
  };
  return (
    <div className="container-x max-w-[960px] pt-7 pb-20">
      <Crumbs items={[['Главная', '/'], ['Мои заказы']]} />
      <PageHead title="Мои заказы" text="Войдите, чтобы видеть все свои заказы, или найдите заказ по номеру." />
      <div className="grid items-start gap-6 md:grid-cols-2">
        <div className="card"><h3 className="h3 mb-2">Найти заказ</h3><p className="text-[13px] text-muted">Номер заказа есть в подтверждении после оплаты.</p>
          <form onSubmit={submit} className="mt-4 space-y-3">
            <input className="input" aria-label="Номер заказа" placeholder="СМ-1025" value={t.code} onChange={(e) => setT({ ...t, code: e.target.value })} />
            <input className="input" type="tel" aria-label="Телефон" placeholder="Телефон, указанный в заказе" value={t.phone} onChange={(e) => setT({ ...t, phone: e.target.value })} />
            <button className="btn btn-primary w-full">Найти</button>
          </form></div>
        <div className="card-soft"><h3 className="h3 mb-2">Личный кабинет</h3><p className="text-[13px] text-muted">История заказов, статусы и уведомления в Telegram — в одном месте.</p>
          <div className="mt-4 flex flex-wrap gap-3"><Link className="btn btn-primary" href="/login?next=/orders">Войти</Link><Link className="btn" href="/login?mode=register&next=/orders">Зарегистрироваться</Link></div></div>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const { user, setUser } = useShop();
  const router = useRouter();
  const [list, setList] = useState<Order[] | null>(null);
  const [f, setF] = useState<'all' | 'active' | 'done'>('all');
  useEffect(() => { if (user) get<Order[]>('/api/orders').then(setList).catch(() => setList([])); }, [user]);
  if (user === null) return <GuestLookup />;
  if (!user || !list) return <div className="container-x py-24 text-center text-muted">Загружаем…</div>;
  const shown = list.filter((o) => f === 'all' || (f === 'active') === ACTIVE.includes(o.status));
  const chips: [typeof f, string, number][] = [['all', 'Все', list.length], ['active', 'Активные', list.filter((o) => ACTIVE.includes(o.status)).length], ['done', 'Завершённые', list.filter((o) => !ACTIVE.includes(o.status)).length]];
  const logout = async () => { await post('/api/auth/logout').catch(() => null); setUser(null); router.push('/login'); };
  return (
    <div className="container-x pt-7 pb-20">
      <Crumbs items={[['Главная', '/'], ['Личный кабинет'], ['Мои заказы']]} />
      <PageHead title="Мои заказы" text="Ваши сладости в пути — все детали и статусы в одном месте." />
      <div className="grid items-start gap-8 md:grid-cols-[240px_1fr]">
        <aside>
          <div className="card-soft"><Icon name="user" /><p className="mt-2 font-semibold">{user.name}</p><p className="text-[13px] text-muted">{user.phone}</p>
            <TelegramConnect className="mt-4" /></div>
          <nav className="mt-4 text-sm [&_a]:block [&_a]:rounded-lg [&_a]:px-3 [&_a]:py-2.5">
            <Link href="/orders" className="bg-accent/5 text-accent">Мои заказы</Link><Link href="/favorites">Избранное</Link><Link href="/catalog">Каталог</Link>
            {user.role === 'admin' && <Link href="/admin">Кабинет администратора</Link>}
            <button className="w-full rounded-lg px-3 py-2.5 text-left" onClick={logout}>Выйти</button>
          </nav>
        </aside>
        <div>
          <div className="mb-4 flex flex-wrap gap-2">{chips.map(([k, t, n]) => <button key={k} className={cn('chip', f === k && 'chip-on')} onClick={() => setF(k)}>{t} · {n}</button>)}</div>
          {shown.length ? <div className="space-y-4">{shown.map((o) => <OrderCard key={o.code} o={o} />)}</div>
            : <Empty title="Заказов пока нет" text="Здесь появятся заказы, оформленные из этого аккаунта."><Link className="btn btn-primary" href="/catalog">Выбрать сладости</Link></Empty>}
        </div>
      </div>
    </div>
  );
}
