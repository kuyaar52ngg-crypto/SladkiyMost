'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useShop } from '@/features/shop/store';
import { TelegramConnect } from '@/features/telegram/TelegramConnect';
import { get } from '@/shared/api/client';
import type { Order } from '@/shared/api/types';
import { fmtDate, fmtRange, rub } from '@/shared/lib/format';
import { Icon, Note } from '@/shared/ui';

export default function SuccessPage() {
  const code = decodeURIComponent(useParams<{ code: string }>().code);
  const { ready, user, profile } = useShop();
  const [o, setO] = useState<Order | null>(null);
  useEffect(() => {
    if (ready && user !== undefined)
      get<Order>(`/api/orders/${encodeURIComponent(code)}?phone=${encodeURIComponent(profile?.phone || '')}`).then(setO).catch(() => null);
  }, [ready, user, profile, code]);
  if (!o) return <div className="container-x py-24 text-center text-muted">Загружаем…</div>;
  const w = o.wave!;
  return (
    <div className="container-x max-w-[820px] pt-7 pb-20">
      <div className="card px-6 py-10 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-accent/5 text-accent"><Icon name="check" className="size-7" /></span>
        <h1 className="mt-4 font-head text-[28px] font-bold md:text-[40px]">Заказ {o.code} оформлен</h1>
        <p className="mt-3 text-muted">{o.gift ? `Подарок для ${o.recipient.name} отправится с волной ${w.title}.` : `Ваши сладости поедут волной ${w.title}.`} Мы пришлём уведомления о каждом этапе.</p>
        <div className="mt-6 grid gap-3 text-left sm:grid-cols-3">
          {[['Сбор до', fmtDate(w.cutoff)], ['Отправка', fmtDate(w.departure)], ['Получение', fmtRange(w.arrival_from, w.arrival_to)]].map(([t, v]) => <div key={t} className="card-soft"><span className="text-[13px] text-muted">{t}</span><b className="block font-head text-xl">{v}</b></div>)}
        </div>
        <Note kind="ok" className="mt-6 text-left">Оплачено {rub(o.total_rub)} (имитация). Доставка {rub(o.delivery_rub)} по тарифу {o.rate_rub} ₽/кг — при закрытии сбора пересчитаем по фактической загрузке и вернём разницу, если станет дешевле.</Note>
        {user && !user.telegram && <div className="mx-auto mt-6 max-w-[320px]"><p className="mb-2 text-[13px] text-muted">Хотите получать статусы заказа в Telegram?</p><TelegramConnect /></div>}
        {user === null && <p className="mt-6 text-[13px] text-muted"><Link className="text-accent underline" href="/login?mode=register&next=/orders">Создайте аккаунт</Link>, чтобы видеть все заказы и получать уведомления в Telegram.</p>}
        <div className="mt-6 flex flex-wrap justify-center gap-3"><Link className="btn btn-primary" href={`/orders/${encodeURIComponent(o.code)}${user ? '' : `?phone=${encodeURIComponent(profile?.phone || '')}`}`}>Отслеживать заказ</Link><Link className="btn" href="/catalog">Продолжить покупки</Link></div>
      </div>
    </div>
  );
}
