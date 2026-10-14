'use client';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState, type FormEvent } from 'react';
import { OrderDetails } from '@/features/account/OrderDetails';
import { useShop } from '@/features/shop/store';
import { useLive } from '@/shared/lib/live';
import { ApiError, get, post } from '@/shared/api/client';
import type { Order } from '@/shared/api/types';
import { Crumbs, Empty } from '@/shared/ui';

/** Гостю для доступа к заказу нужен телефон покупателя или получателя. */
function PhoneGate({ code, error, onPhone }: { code: string; error: string; onPhone: (p: string) => void }) {
  const [v, setV] = useState('');
  const submit = (e: FormEvent) => { e.preventDefault(); onPhone(v); };
  return (
    <div className="container-x max-w-[480px] py-10">
      <div className="card"><h2 className="h2">Заказ {code}</h2><p className="mt-2 text-muted">Укажите телефон, на который оформлен заказ, или <Link className="text-accent underline" href={`/login?next=${encodeURIComponent(`/orders/${code}`)}`}>войдите в аккаунт</Link>.</p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <input className="input" type="tel" aria-label="Телефон" placeholder="+7 (___) ___-__-__" value={v} onChange={(e) => setV(e.target.value)} />
          {error && <p role="alert" className="text-xs text-accent">{error}</p>}
          <button className="btn btn-primary w-full">Показать заказ</button>
        </form></div>
    </div>
  );
}

function OrderView() {
  const code = decodeURIComponent(useParams<{ code: string }>().code);
  const { profile, user, toast } = useShop();
  const [phone, setPhone] = useState(useSearchParams().get('phone') || '');
  const [o, setO] = useState<Order | null | false | 'locked'>(null);
  const [gateErr, setGateErr] = useState('');
  const p = phone || profile?.phone || '';
  const load = useCallback(() => get<Order>(`/api/orders/${encodeURIComponent(code)}?phone=${encodeURIComponent(p)}`).then(setO)
    .catch((e) => {
      if (e instanceof ApiError && e.status === 403) { setGateErr(p ? 'Телефон не совпадает с заказом' : ''); setO('locked'); }
      else setO(false);
    }), [code, p]);
  useEffect(() => { if (user !== undefined) load(); }, [load, user]);
  useLive(() => { if (user !== undefined) load(); });
  if (o === null) return <div className="container-x py-24 text-center text-muted">Загружаем…</div>;
  if (o === 'locked') return <PhoneGate code={code} error={gateErr} onPhone={setPhone} />;
  if (!o) return <div className="container-x py-10"><Empty title="Заказ не найден" text="Проверьте номер заказа."><Link className="btn" href="/orders">К заказам</Link></Empty></div>;

  const cancel = async () => {
    try { await post(`/api/orders/${encodeURIComponent(o.code)}/cancel`, { phone: p }); toast('Заказ отменён'); load(); }
    catch (e) { toast((e as Error).message); }
  };
  return (
    <div className="container-x pt-7 pb-20">
      <Crumbs items={[['Главная', '/'], ['Мои заказы', user ? '/account/orders' : '/orders'], [`Заказ ${o.code}`]]} />
      <h1 className="h1-sm mb-7">Заказ № {o.code}</h1>
      <OrderDetails o={o} onCancel={cancel} inAccount={!!user} />
    </div>
  );
}

export default function OrderPage() {
  return <Suspense><OrderView /></Suspense>;
}
