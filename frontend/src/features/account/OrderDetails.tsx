'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useShop } from '@/features/shop/store';
import type { Order } from '@/shared/api/types';
import { cn, fmtDate, kg, rub } from '@/shared/lib/format';
import { Card, Info, Items, OrderPath, OrderPill, orderHint, Row, units, WaveBlock } from './parts';

const CARD_BG: Record<string, string> = {
  berry: 'bg-gradient-to-br from-[#fbf0f1] to-[#f6e1e4]', snow: 'bg-gradient-to-br from-[#eef4f8] to-[#fdfdfd]',
  sun: 'bg-gradient-to-br from-[#fdf3e5] to-[#fbe8d3]',
};

/** Карточка заказа (макет «Заказ № СМ-…»): состав, получатель, сводка, сборная партия, история. */
export function OrderDetails({ o, related = [o.code], onCancel, inAccount }: {
  o: Order; related?: string[]; onCancel?: () => Promise<void>; inAccount?: boolean;
}) {
  const { add } = useShop();
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const r = o.recipient;
  const cancel = async () => {
    if (!confirm) { setConfirm(true); return; }
    await onCancel?.();
    setConfirm(false);
  };
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <span className="pill">Заказ № {o.code}</span>
        <span className="pill pill-soft">{fmtDate(o.created_at, true)}</span>
        <OrderPill o={o} soft />
      </div>
      <Info className="mt-6">{orderHint(o)}</Info>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card title={`Состав · ${units(o)} шт.`}><Items o={o} /></Card>
          <Card title="Получатель">
            <p className="font-semibold">{r.name}</p>
            <p className="mt-3 text-[15px]">{r.receive === 'courier' ? `${r.city}, ${r.address}` : `Пункт выдачи: ${r.address}`}</p>
            <p className="mt-3 text-[15px]">{r.phone}</p>
            <p className="mt-3 text-[13px] text-muted">Покупатель: {o.customer_name}, {o.customer_phone}{o.company ? ` · ${o.company}` : ''}</p>
          </Card>
          {o.gift && (
            <Card title="Открытка">
              <div className={cn('rounded-card p-6', CARD_BG[o.gift.card] || 'bg-pink')}>
                <p className="mb-3 font-head text-[22px] font-bold">{r.name.split(' ')[0]},</p>
                <p className="text-[15px] whitespace-pre-wrap">{o.gift.message}</p>
                <p className="mt-3.5 font-semibold">{o.gift.signature}</p>
              </div>
              {o.gift.surprise && <p className="mt-3 text-[13px] text-muted">Сюрприз: свяжемся с вами перед вручением.</p>}
            </Card>
          )}
        </div>
        <div className="space-y-6">
          <Card title="Сводка заказа" soft>
            <Row k={`Товары · ${units(o)} шт.`} v={rub(o.goods_rub)} />
            <Row k="Вес с упаковкой" v={kg(o.weight_kg)} />
            <Row k={`Доставка · ${o.rate_rub} ₽/кг`} v={rub(o.delivery_rub)} />
            {o.thermo_rub > 0 && <Row k="Термоупаковка" v={rub(o.thermo_rub)} />}
            {o.receive_rub > 0 && <Row k="Курьер" v={rub(o.receive_rub)} />}
            {o.gift_rub > 0 && <Row k="Коробка и открытка" v={rub(o.gift_rub)} />}
            <div className="mt-2 border-t border-line pt-3"><Row k="Итого" v={rub(o.total_rub)} /></div>
            {o.final_delivery_rub !== null
              ? <p className="mt-3 text-[13px] text-ok">{o.refund_rub ? `Партия закрыта: итоговая доставка ${rub(o.final_delivery_rub)}, вернём ${rub(o.refund_rub)}.` : `Партия закрыта: доставка подтверждена — ${rub(o.final_delivery_rub)}.`}</p>
              : <p className="mt-3 text-[13px] text-muted">Доставка рассчитана по текущей загрузке партии. Если партия наберёт больше, разницу вернём после закрытия приёма.</p>}
            <p className="mt-2 text-[13px] text-muted">{o.payment_method}</p>
          </Card>
          <WaveBlock wave={o.wave} codes={related} />
          <Card title="История заказа"><OrderPath o={o} /></Card>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        {inAccount && <Link className="btn btn-primary" href={`/account/support?order=${encodeURIComponent(o.code)}`}>Задать вопрос о заказе</Link>}
        <button type="button" className={cn('btn', !inAccount && 'btn-primary')} onClick={() => { o.items.forEach((i) => add(i, i.qty)); router.push('/cart'); }}>Повторить заказ</button>
        <Link className="btn" href="/catalog">Продолжить покупки</Link>
        {o.status === 'accepted' && onCancel && (
          <button type="button" className="btn btn-ghost text-accent" onClick={cancel}>{confirm ? 'Точно отменить? Нажмите ещё раз' : 'Отменить заказ'}</button>
        )}
      </div>
    </>
  );
}
