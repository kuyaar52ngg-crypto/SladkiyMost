'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useOrders } from '@/features/account/data';
import { AccountHead } from '@/features/account/page';
import { ACTIVE, Card, Info, OrderPath, OrderPill, orderHint, Row, WaveBlock } from '@/features/account/parts';
import { fmtDate } from '@/shared/lib/format';

function Tracking() {
  const [orders] = useOrders();
  const sp = useSearchParams();
  const router = useRouter();
  if (!orders) return <p className="text-muted">Загружаем…</p>;
  const choices = orders.filter((o) => o.status !== 'cancelled');
  const o = choices.find((x) => x.code === sp.get('order')) || choices.find((x) => ACTIVE.includes(x.status)) || choices[0];
  if (!o) {
    return (
      <Card title="Пока нечего отслеживать">
        <p className="text-muted">Когда вы оформите заказ, здесь появится его путь — от сборной партии до получения.</p>
        <Link className="btn btn-primary mt-5" href="/catalog">Выбрать сладости</Link>
      </Card>
    );
  }
  const related = orders.filter((x) => x.wave?.id === o.wave?.id && x.status !== 'cancelled').map((x) => x.code);
  const r = o.recipient;
  return (
    <>
      <label className="field">
        <span className="label text-[15px]">Заказ</span>
        <select className="select" value={o.code} onChange={(e) => router.replace(`/account/tracking?order=${encodeURIComponent(e.target.value)}`)}>
          {choices.map((x) => <option key={x.code} value={x.code}>№ {x.code} · {fmtDate(x.created_at, true)}</option>)}
        </select>
      </label>
      <div className="mt-5"><OrderPill o={o} /></div>
      <Info className="mt-5">{orderHint(o)}</Info>
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <Card title="Путь заказа">
          <OrderPath o={o} note="Этапы обновляются, когда партия закрывается, уходит в путь и прибывает. Об изменениях сообщим в уведомлениях." />
        </Card>
        <WaveBlock wave={o.wave} codes={related} />
        <Card title="Получатель">
          <p className="font-semibold">{r.name}</p>
          <p className="mt-3 text-[15px]">{r.receive === 'courier' ? `${r.city}, ${r.address}` : `Пункт выдачи: ${r.address}`}</p>
          <p className="mt-3 text-[15px]">{r.phone}</p>
        </Card>
        <Card title="Условия получения">
          <Row k="Способ" v={r.receive === 'courier' ? 'Курьер до адреса' : 'Пункт выдачи'} />
          <Row k="Направление" v={o.direction_title} />
          <Row k="Термоупаковка" v={o.thermo_rub > 0 ? 'Да' : 'Не нужна'} />
          <Row k="Оплата" v={o.payment_method} />
        </Card>
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link className="btn btn-primary" href={`/account/support?order=${encodeURIComponent(o.code)}`}>Задать вопрос о доставке</Link>
        <Link className="btn" href={`/account/orders/${encodeURIComponent(o.code)}`}>Подробности заказа</Link>
      </div>
    </>
  );
}

export default function TrackingPage() {
  return (
    <>
      <AccountHead title="Отслеживание доставки" />
      <Suspense><Tracking /></Suspense>
    </>
  );
}
