'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Layout, Loading, NeedItems, Summary, useCheckoutItems } from '@/features/checkout/common';
import { lines, other, useShop } from '@/features/shop/store';
import { post } from '@/shared/api/client';
import type { Offer } from '@/shared/api/types';
import { cn, fmtDate, fmtRange, kg, plural, rub } from '@/shared/lib/format';
import { Crumbs, FillBar, Icon, Kv, Note, PageHead, Steps, Total } from '@/shared/ui';

export default function WavePage() {
  const { ready, items, origin } = useCheckoutItems();
  const { meta, draft, setDraft, toast } = useShop();
  const router = useRouter();
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const key = JSON.stringify(lines(items));

  useEffect(() => {
    if (!ready || !items.length) return;
    post<Offer[]>('/api/waves/offers', { items: JSON.parse(key) }).then(setOffers).catch((e) => toast(e.message));
  }, [ready, key, items.length, toast]);

  if (!ready) return <Loading />;
  if (!items.length || !origin) return <NeedItems />;
  if (!offers) return <Loading />;

  const open = offers.filter((o) => o.wave.open && o.quote?.fits);
  const selected = open.find((o) => o.wave.id === draft.wave_id) || open[0];
  const to = meta.regions[other(origin)];
  const max = meta.policy.max_load_kg;

  return (
    <div className="container-x pt-7 pb-20">
      <Crumbs items={[['Главная', '/'], ['Корзина', '/cart'], ['Выбор сборной отправки']]} />
      <PageHead title="Выбор сборной отправки" text="Найдём попутную волну для ваших сладостей." />
      <Steps current={2} />
      <Layout
        main={<>
          <div className="card"><h3 className="h3 mb-4">Куда отправляем?</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="field"><span className="label">Регион отправления</span><div className="input bg-soft">{meta.regions[origin].name}</div><span className="hint">По составу корзины</span></div>
              <div className="field"><span className="label">Регион получения</span><div className="input bg-soft">{to.name} · {to.city} и область</div><span className="hint">Сладости едут к получателю в другой регион</span></div>
            </div></div>
          <div className="mt-6 mb-3.5 flex items-center justify-between"><h3 className="h3">Отправки в {to.name === 'Якутия' ? 'Якутию' : 'Донбасс'}</h3><span className="tag tag-muted">Каждые {meta.policy.wave_interval_days} дней</span></div>
          <div className="space-y-3.5" role="radiogroup">
            {offers.map(({ wave: w, quote: q }) => {
              const sel = selected?.wave.id === w.id;
              const disabled = !w.open || !q?.fits;
              const status = !w.open ? (w.status === 'collecting' ? 'Партия заполнена' : 'Сбор закрыт') : sel ? 'Выбрана' : w.fill > 0.8 ? 'Почти заполнена' : 'Идёт сбор';
              return (
                <label key={w.id} className={cn('block rounded-card border p-5 transition', disabled ? 'cursor-default bg-soft opacity-75' : 'cursor-pointer hover:border-line-strong', sel ? 'border-accent bg-pink' : 'border-line')}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="flex items-center gap-3 font-head text-[19px] font-semibold">
                      <input type="radio" name="wave" className="size-[18px] accent-accent" checked={sel} disabled={disabled} onChange={() => setDraft({ wave_id: w.id })} />{w.title}
                    </span>
                    <span className={cn('tag', disabled && 'tag-muted')}>{status}</span>
                  </div>
                  <div className="mt-3.5 grid gap-2 text-sm sm:grid-cols-3 sm:gap-3">
                    <div><span className="block text-xs text-muted">Сбор заказов</span>{w.open ? <>До {fmtDate(w.cutoff)} <span className="text-[13px] text-muted">({w.days_left} {plural(w.days_left, 'день', 'дня', 'дней')})</span></> : `Завершён ${fmtDate(w.cutoff)}`}</div>
                    <div><span className="block text-xs text-muted">Отправка</span>{fmtDate(w.departure)}</div>
                    <div><span className="block text-xs text-muted">Получение, ориентир</span>{fmtRange(w.arrival_from, w.arrival_to)}{w.off_season && <span className="tag tag-warn ml-1">+7 дн.</span>}</div>
                  </div>
                  <FillBar load={w.load_kg} add={w.open && q ? q.weight_kg : 0} max={max} />
                  <div className="mt-1.5 flex flex-wrap justify-between gap-2 text-xs text-muted">
                    <span>В партии {kg(w.load_kg)} из {max}{w.open && q && ` + ваши ${kg(q.weight_kg)}`}</span>
                    <span>{w.open && q ? <>Тариф с вашим заказом: <b className="text-accent">{q.rate} ₽/кг</b></> : `Итоговый тариф ${w.final_rate ?? w.rate} ₽/кг`}</span>
                  </div>
                  {w.open && q && <p className="mt-2 text-[13px] text-accent">Для вашей корзины {kg(q.weight_kg)} · доставка ≈ {rub(q.delivery_rub)}{q.saving_rub > 0 && ` (экономия ${rub(q.saving_rub)})`}. {!q.min_reached && `До минимума отправки ${meta.policy.min_load_kg} кг осталось ${kg(meta.policy.min_load_kg - q.projected_load_kg)}.`}</p>}
                </label>
              );
            })}
          </div>
          <Note className="mt-4">Приём заказов закрывается за {meta.policy.cutoff_days_before} дня до отправки. Если партия не наберёт {meta.policy.min_load_kg} кг, перенесём заказ в следующую волну без доплаты.</Note>
          <Link className="btn mt-6" href="/cart"><Icon name="back" className="size-4" />Вернуться в корзину</Link>
        </>}
        aside={<div className="card-soft"><h3 className="h3 mb-4">Ваш заказ</h3>
          <Summary items={items}>{selected?.quote && <><Kv k="Доставка, предварительно" v={rub(selected.quote.delivery_rub)} /><hr className="divider" /><Total label="Предварительный итог" value={rub(selected.quote.goods_rub + selected.quote.delivery_rub)} /></>}</Summary>
          {!selected && <Note className="mt-3">Нет открытых волн — загляните позже.</Note>}
          <button className="btn btn-primary mt-4 w-full" disabled={!selected} onClick={() => { setDraft({ wave_id: selected!.wave.id }); router.push('/checkout/calc'); }}>Рассчитать доставку</button>
          <p className="mt-3 text-xs text-muted">Предварительный расчёт. Деньги сейчас не списываются.</p></div>}
      />
    </div>
  );
}
