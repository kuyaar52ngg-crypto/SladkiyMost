'use client';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState, type FormEvent } from 'react';
import { OrderCard } from '@/features/orders/OrderCard';
import { useShop } from '@/features/shop/store';
import { ApiError, get, post } from '@/shared/api/client';
import type { Order } from '@/shared/api/types';
import { cn, fmtDate, fmtRange, kg, rub } from '@/shared/lib/format';
import { Crumbs, Empty, Kv, Note, Total } from '@/shared/ui';

const CARD_BG: Record<string, string> = { berry: 'bg-gradient-to-br from-[#fbf0f1] to-[#f6e1e4]', snow: 'bg-gradient-to-br from-[#eef4f8] to-[#fdfdfd]', sun: 'bg-gradient-to-br from-[#fdf3e5] to-[#fbe8d3]' };

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
  const { add, profile, user, toast } = useShop();
  const router = useRouter();
  const [phone, setPhone] = useState(useSearchParams().get('phone') || '');
  const [o, setO] = useState<Order | null | false | 'locked'>(null);
  const [gateErr, setGateErr] = useState('');
  const [confirm, setConfirm] = useState(false);
  const p = phone || profile?.phone || '';
  const load = useCallback(() => get<Order>(`/api/orders/${encodeURIComponent(code)}?phone=${encodeURIComponent(p)}`).then(setO)
    .catch((e) => {
      if (e instanceof ApiError && e.status === 403) { setGateErr(p ? 'Телефон не совпадает с заказом' : ''); setO('locked'); }
      else setO(false);
    }), [code, p]);
  useEffect(() => { if (user !== undefined) load(); }, [load, user]);
  if (o === null) return <div className="container-x py-24 text-center text-muted">Загружаем…</div>;
  if (o === 'locked') return <PhoneGate code={code} error={gateErr} onPhone={setPhone} />;
  if (!o) return <div className="container-x py-10"><Empty title="Заказ не найден" text="Проверьте номер заказа."><Link className="btn" href="/orders">К заказам</Link></Empty></div>;

  const cancel = async () => {
    if (!confirm) { setConfirm(true); return; }
    try { await post(`/api/orders/${encodeURIComponent(o.code)}/cancel`, { phone: p }); toast('Заказ отменён'); load(); }
    catch (e) { toast((e as Error).message); }
  };
  const w = o.wave;
  return (
    <div className="container-x pt-7 pb-20">
      <Crumbs items={[['Главная', '/'], ['Мои заказы', '/orders'], [`Заказ ${o.code}`]]} />
      <div className="grid items-start gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {o.status === 'accepted' && <Note>Заказ принят. Ждём закрытия сбора — после этого соберём партию и пришлём итоговый расчёт доставки.</Note>}
          <OrderCard o={o} compact={false} />
          {o.gift && <div className="card"><h3 className="h3 mb-4">Открытка</h3>
            <div className={cn('rounded-card p-6', CARD_BG[o.gift.card] || 'bg-pink')}><p className="mb-3 font-head text-[22px] text-accent">{o.recipient.name.split(' ')[0]},</p><p className="text-sm whitespace-pre-wrap">{o.gift.message}</p><p className="mt-3.5 text-[13px] font-semibold">{o.gift.signature}</p></div>
            {o.gift.surprise && <p className="mt-3 text-[13px] text-muted">Сюрприз: свяжемся с вами перед вручением.</p>}</div>}
          <div className="card"><h3 className="h3 mb-3">История</h3>{[...o.history].reverse().map((h, i) => <div key={i} className="flex flex-wrap justify-between gap-2 py-1.5 text-sm"><span>{fmtDate(h.date, true)} · {h.status_title}</span><span className="text-[13px] text-muted">{h.note}</span></div>)}</div>
        </div>
        <aside className="flex flex-col gap-4 lg:sticky lg:top-32">
          <div className="card-soft"><h3 className="h3 mb-4">Сумма</h3>
            <Kv k="Товары" v={rub(o.goods_rub)} /><Kv k={`Доставка (${kg(o.weight_kg)} × ${o.rate_rub} ₽)`} v={rub(o.delivery_rub)} />
            {o.thermo_rub > 0 && <Kv k="Термоупаковка" v={rub(o.thermo_rub)} />}{o.receive_rub > 0 && <Kv k="Курьер" v={rub(o.receive_rub)} />}{o.gift_rub > 0 && <Kv k="Коробка и открытка" v={rub(o.gift_rub)} />}
            <hr className="divider" /><Total label="Оплачено" value={rub(o.total_rub)} />
            {o.final_delivery_rub !== null && <Note kind="ok" className="mt-3">{o.refund_rub ? `Сбор закрыт: итоговая доставка ${rub(o.final_delivery_rub)}. Вернём ${rub(o.refund_rub)}.` : `Сбор закрыт: доставка подтверждена — ${rub(o.final_delivery_rub)}.`}</Note>}
            <p className="mt-3 text-xs text-muted">{o.payment_method} · оплата — имитация (заглушка)</p></div>
          {w && <div className="card"><h3 className="h3 mb-3">Волна</h3><p>{w.title}</p><p className="mt-2 text-[13px] text-muted">Отправка {fmtDate(w.departure)} · получение {fmtRange(w.arrival_from, w.arrival_to)}{w.off_season && ' (межсезонье +7 дн.)'}</p></div>}
          <button className="btn w-full" onClick={() => { o.items.forEach((i) => add(i, i.qty)); router.push('/cart'); }}>Повторить заказ</button>
          {o.status === 'accepted' && <button className="btn btn-ghost w-full" onClick={cancel}>{confirm ? 'Точно отменить? Нажмите ещё раз' : 'Отменить заказ'}</button>}
        </aside>
      </div>
    </div>
  );
}

export default function OrderPage() {
  return <Suspense><OrderView /></Suspense>;
}
