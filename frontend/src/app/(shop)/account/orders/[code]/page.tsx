'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useOrders } from '@/features/account/data';
import { OrderDetails } from '@/features/account/OrderDetails';
import { AccountHead } from '@/features/account/page';
import { useShop } from '@/features/shop/store';
import { get, post } from '@/shared/api/client';
import { useLive } from '@/shared/lib/live';
import type { Order } from '@/shared/api/types';

export default function AccountOrder() {
  const code = decodeURIComponent(useParams<{ code: string }>().code);
  const { toast } = useShop();
  const [o, setO] = useState<Order | null | false>(null);
  const [orders] = useOrders();
  const load = useCallback(() => { get<Order>(`/api/orders/${encodeURIComponent(code)}`).then(setO).catch(() => setO(false)); }, [code]);
  useEffect(load, [load]);
  useLive(load);
  if (o === null) return <p className="text-muted">Загружаем…</p>;
  if (!o) {
    return (
      <>
        <AccountHead title="Заказ не найден" />
        <p className="text-muted">Проверьте номер заказа.</p>
        <Link className="btn mt-6" href="/account/orders">К моим заказам</Link>
      </>
    );
  }
  const related = (orders || []).filter((x) => x.wave?.id === o.wave?.id && x.status !== 'cancelled').map((x) => x.code);
  const cancel = async () => {
    try { await post(`/api/orders/${encodeURIComponent(o.code)}/cancel`, {}); toast('Заказ отменён'); load(); }
    catch (e) { toast((e as Error).message); }
  };
  return (
    <>
      <AccountHead title={`Заказ № ${o.code}`} />
      <OrderDetails o={o} related={related.length ? related : [o.code]} onCancel={cancel} inAccount />
    </>
  );
}
