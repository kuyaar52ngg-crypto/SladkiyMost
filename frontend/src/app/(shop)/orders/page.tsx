'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useShop } from '@/features/shop/store';
import { Crumbs, PageHead } from '@/shared/ui';

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
          <div className="mt-4 flex flex-wrap gap-3"><Link className="btn btn-primary" href="/login?next=/account/orders">Войти</Link><Link className="btn" href="/login?mode=register&next=/account/orders">Зарегистрироваться</Link></div></div>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const { user } = useShop();
  const router = useRouter();
  useEffect(() => { if (user) router.replace('/account/orders'); }, [user, router]);
  if (user === null) return <GuestLookup />;
  return <div className="container-x py-24 text-center text-muted">Загружаем…</div>;
}
