import Link from 'next/link';
import { get } from '@/shared/api/client';
import type { Order } from '@/shared/api/types';
import { fmtDate, fmtRange, rub } from '@/shared/lib/format';
import { Icon, Note } from '@/shared/ui';

export default async function SuccessPage({ params }: { params: Promise<{ code: string }> }) {
  const o = await get<Order>(`/api/orders/${encodeURIComponent(decodeURIComponent((await params).code))}`);
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
        <div className="mt-6 flex flex-wrap justify-center gap-3"><Link className="btn btn-primary" href={`/orders/${encodeURIComponent(o.code)}`}>Отслеживать заказ</Link><Link className="btn" href="/catalog">Продолжить покупки</Link></div>
      </div>
    </div>
  );
}
