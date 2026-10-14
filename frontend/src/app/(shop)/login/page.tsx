'use client';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { AuthForm } from '@/features/auth/AuthForm';
import { useShop } from '@/features/shop/store';

function Login() {
  const { user, profile } = useShop();
  const router = useRouter();
  const sp = useSearchParams();
  const raw = sp.get('next') || '/orders';
  const next = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/orders';
  const [t, setT] = useState({ code: '', phone: '' });
  useEffect(() => { if (user) router.replace(next); }, [user, next, router]);
  useEffect(() => { if (profile) setT((x) => ({ ...x, phone: x.phone || profile.phone })); }, [profile]);

  const track = (e: FormEvent) => {
    e.preventDefault();
    const n = t.code.replace(/\D/g, '');
    if (n) router.push(`/orders/${encodeURIComponent('СМ-' + n)}?phone=${encodeURIComponent(t.phone)}`);
  };
  return (
    <div className="container-x max-w-[960px] pt-7 pb-20">
      <div className="grid items-start gap-8 md:grid-cols-2">
        <div className="card"><h2 className="h2">Личный кабинет</h2><p className="mt-2 mb-5 text-muted">Войдите, чтобы видеть свои заказы и получать уведомления в Telegram.</p>
          <AuthForm mode={sp.get('mode') === 'register' ? 'register' : 'login'} onDone={() => router.replace(next)} />
        </div>
        <div className="card-soft"><h3 className="h3 mb-2">Отследить заказ без входа</h3><p className="text-[13px] text-muted">Введите номер заказа и телефон, указанный при оформлении.</p>
          <form onSubmit={track} className="mt-4 space-y-3">
            <input className="input" aria-label="Номер заказа" placeholder="СМ-1025" value={t.code} onChange={(e) => setT({ ...t, code: e.target.value })} />
            <input className="input" type="tel" aria-label="Телефон" placeholder="+7 (___) ___-__-__" value={t.phone} onChange={(e) => setT({ ...t, phone: e.target.value })} />
            <button className="btn w-full">Найти заказ</button>
          </form>
          <div className="relative mt-6 aspect-[3/2] overflow-hidden rounded-card"><Image src="/img/gift.jpg" alt="" fill sizes="480px" className="object-cover" /></div></div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense><Login /></Suspense>;
}
