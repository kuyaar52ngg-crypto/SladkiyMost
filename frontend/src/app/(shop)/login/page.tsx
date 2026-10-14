'use client';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { useShop } from '@/features/shop/store';

function Login() {
  const { setProfile } = useShop();
  const router = useRouter();
  const next = useSearchParams().get('next') || '/orders';
  const [v, setV] = useState({ name: '', phone: '' });
  const [num, setNum] = useState('');
  const [err, setErr] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (v.phone.replace(/\D/g, '').length < 10) { setErr('Введите номер телефона полностью'); return; }
    setProfile({ name: v.name || 'Покупатель', phone: v.phone });
    router.push(next.startsWith('/') ? next : '/orders');
  };
  const track = (e: FormEvent) => {
    e.preventDefault();
    const n = num.replace(/\D/g, '');
    if (n) router.push(`/orders/${encodeURIComponent('СМ-' + n)}`);
  };
  return (
    <div className="container-x max-w-[960px] pt-7 pb-20">
      <div className="grid items-start gap-8 md:grid-cols-2">
        <div className="card"><h2 className="h2">Вход</h2><p className="mt-2 text-muted">Войдите по номеру телефона, чтобы видеть свои заказы и подарки.</p>
          <form onSubmit={submit} className="mt-4 space-y-3" noValidate>
            <label className="field"><span className="label">Имя</span><input className="input" autoComplete="name" placeholder="Анна" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></label>
            <label className="field"><span className="label">Телефон *</span><input className="input" type="tel" autoComplete="tel" placeholder="+7 (___) ___-__-__" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /></label>
            {err && <p className="text-xs text-accent">{err}</p>}
            <button className="btn btn-primary w-full">Войти</button>
          </form>
          <p className="mt-4 text-xs text-muted">В MVP вход упрощён: код из СМС имитируется.</p></div>
        <div className="card-soft"><h3 className="h3 mb-2">Отследить заказ</h3><p className="text-[13px] text-muted">Знаете номер заказа? Введите его — покажем статус.</p>
          <form onSubmit={track} className="mt-4 flex gap-3"><input className="input" aria-label="Номер заказа" placeholder="СМ-1025" value={num} onChange={(e) => setNum(e.target.value)} /><button className="btn">Найти</button></form>
          <div className="relative mt-6 aspect-[3/2] overflow-hidden rounded-card"><Image src="/img/gift.jpg" alt="" fill sizes="480px" className="object-cover" /></div></div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense><Login /></Suspense>;
}
