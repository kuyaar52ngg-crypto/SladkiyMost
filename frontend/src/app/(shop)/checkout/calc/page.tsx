'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Layout, Loading, NeedItems, Summary, useCheckoutItems } from '@/features/checkout/common';
import { lines, other, useShop } from '@/features/shop/store';
import { post } from '@/shared/api/client';
import type { QuoteResponse } from '@/shared/api/types';
import { cn, fmtDate, fmtRange, kg, rub } from '@/shared/lib/format';
import { Crumbs, FillBar, Kv, Note, PageHead, Steps, Total } from '@/shared/ui';

export default function CalcPage() {
  const { ready, items, origin } = useCheckoutItems();
  const { meta, draft, setDraft, toast } = useShop();
  const router = useRouter();
  const [r, setR] = useState<QuoteResponse | null>(null);
  const key = JSON.stringify(lines(items));
  const receive = draft.receive || 'pickup';

  useEffect(() => {
    if (!ready || !items.length) return;
    if (!draft.wave_id) { router.replace('/checkout/wave'); return; }
    post<QuoteResponse>('/api/quote', { items: JSON.parse(key), wave_id: draft.wave_id, thermo: !!draft.thermo, gift: !!draft.gift, receive })
      .then((res) => {
        if (!res.wave.open) { toast('Приём в эту волну закрыт — выберите другую'); setDraft({ wave_id: null }); router.replace('/checkout/wave'); return; }
        setR(res);
      })
      .catch((e) => { toast(e.message); router.replace('/checkout/wave'); });
  }, [ready, key, items.length, draft.wave_id, draft.thermo, draft.gift, receive, router, setDraft, toast]);

  const points = origin ? meta.pickup_points[other(origin)] : [];
  useEffect(() => { if (ready && points.length && !points.includes(draft.pickup_point || '')) setDraft({ pickup_point: points[0] }); }, [ready, points, draft.pickup_point, setDraft]);

  if (!ready) return <Loading />;
  if (!items.length || !origin) return <NeedItems />;
  if (!r) return <Loading />;
  const { wave: w, quote: q } = r;
  const p = meta.policy;
  const to = meta.regions[other(origin)];
  const rows: [string, number][] = [['до 50%', p.base_tariff], ...[...p.discounts].reverse().map(([t, pc]) => [`более ${t * 100}%`, p.base_tariff * (1 - pc / 100)] as [string, number])];
  const deliveryAll = q.delivery_rub + q.thermo_rub + q.receive_rub;

  return (
    <div className="container-x pt-7 pb-20">
      <Crumbs items={[['Главная', '/'], ['Корзина', '/cart'], ['Отправка', '/checkout/wave'], ['Расчёт стоимости доставки']]} />
      <PageHead title="Расчёт стоимости доставки" text="Показываем, из чего складывается ваша доля в сборной отправке." />
      <Steps current={3} />
      <Layout
        main={<div className="space-y-4">
          <div className="card"><h3 className="h3 mb-4">Параметры расчёта</h3>
            <div className="flex flex-wrap items-center justify-between gap-3"><p>{w.title} · отправка {fmtDate(w.departure)} · получение {fmtRange(w.arrival_from, w.arrival_to)}</p><Link className="btn btn-sm" href="/checkout/wave">Изменить</Link></div></div>
          <div className="card-pink"><h3 className="h3 mb-3">Как распределяются расходы</h3><span className="tag">Предварительный расчёт</span>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[[kg(w.load_kg), 'уже в партии'], [kg(q.weight_kg), 'ваш заказ с упаковкой'], [`${Math.round(q.fill * 100)}%`, 'заполнение с вашим заказом']].map(([b, s]) => <div key={s}><b className="block font-head text-[28px] font-semibold">{b}</b><span className="text-[13px] text-muted">{s}</span></div>)}
            </div>
            <FillBar load={w.load_kg} add={q.weight_kg} max={p.max_load_kg} />
            <div className="mt-1.5 flex justify-between text-xs text-muted"><span>0</span><span>50% · −20%</span><span>80% · −35%</span><span>{p.max_load_kg} кг</span></div>
            <hr className="divider" />
            <p className="formula">{kg(q.weight_kg)} × {q.rate} ₽/кг = {rub(q.delivery_rub)}</p>
            <p className="text-[13px] text-muted">Вес: {kg(q.net_kg)} нетто × {p.packaging_factor} на упаковку. Отдельной посылкой по базовому тарифу — {rub(q.base_delivery_rub)}{q.saving_rub > 0 && <>, сборная отправка экономит <b className="text-accent">{rub(q.saving_rub)}</b></>}.</p>
            {q.next_discount && <p className="mt-2 text-[13px]">Ещё {kg(q.next_discount.need_kg)} в партии — и тариф для всех участников станет {q.next_discount.rate} ₽/кг. Пересчитаем при закрытии сбора.</p>}
            <table className="mt-4 w-full text-sm"><thead><tr className="text-left text-[13px] text-muted"><th className="py-2 font-semibold">Заполнение</th><th className="font-semibold">Тариф</th></tr></thead>
              <tbody>{rows.map(([t, rate]) => <tr key={t} className={cn('border-t border-line', rate === q.rate && 'bg-accent/5 font-semibold text-accent')}><td className="px-2 py-2.5">{t}</td><td>{rate} ₽/кг</td></tr>)}</tbody></table>
          </div>
          <div className="card"><h3 className="h3 mb-4">Сезон и упаковка</h3>
            {q.thermo.required ? <Note kind="warn">{q.thermo.reason} Термоупаковка добавлена: +{rub(p.thermo_price)}.</Note> : <>
              <label className="check"><input type="checkbox" checked={!!draft.thermo} onChange={(e) => setDraft({ thermo: e.target.checked })} />Добавить термоупаковку · +{rub(p.thermo_price)}</label>
              <p className="mt-2 text-[13px] text-muted">{q.thermo.sensitive ? q.thermo.reason : 'В заказе нет шоколадных изделий — термоупаковка не обязательна.'}</p></>}
            {w.off_season && <Note kind="warn" className="mt-3">Межсезонье (ледостав/ледоход на Лене): срок доставки увеличен на 7 дней — уже учтено в датах.</Note>}
          </div>
          <div className="card"><h3 className="h3 mb-4">Получение: {to.city} и область</h3>
            <div className="space-y-2.5">
              <label className={cn('flex cursor-pointer gap-3 rounded-card border p-4', receive === 'pickup' ? 'border-accent bg-pink' : 'border-line')}>
                <input type="radio" className="mt-0.5 size-[18px] accent-accent" checked={receive === 'pickup'} onChange={() => setDraft({ receive: 'pickup' })} />
                <div className="grow"><div className="flex justify-between gap-3 font-semibold"><span>В пункте выдачи</span><span>бесплатно</span></div>
                  <select className="select mt-3" value={draft.pickup_point || ''} onChange={(e) => setDraft({ pickup_point: e.target.value, receive: 'pickup' })}>{points.map((pt) => <option key={pt}>{pt}</option>)}</select></div>
              </label>
              <label className={cn('flex cursor-pointer gap-3 rounded-card border p-4', receive === 'courier' ? 'border-accent bg-pink' : 'border-line')}>
                <input type="radio" className="mt-0.5 size-[18px] accent-accent" checked={receive === 'courier'} onChange={() => setDraft({ receive: 'courier' })} />
                <div className="grow"><div className="flex justify-between gap-3 font-semibold"><span>Курьером до адреса</span><span>{rub(p.courier_price)}</span></div><p className="mt-2 text-[13px] text-muted">Адрес укажете при оформлении.</p></div>
              </label>
            </div>
          </div>
          <Note>Если при закрытии сбора тариф снизится — вернём разницу. Выше указанной суммы доставка не станет.</Note>
        </div>}
        aside={<>
          <div className="card"><h3 className="h3 mb-4">Ваша доставка</h3>
            <Kv k="Доля перевозки" v={rub(q.delivery_rub)} />{q.thermo_rub > 0 && <Kv k="Термоупаковка" v={rub(q.thermo_rub)} />}
            <Kv k={receive === 'courier' ? 'Курьер' : 'Пункт выдачи'} v={q.receive_rub ? rub(q.receive_rub) : 'бесплатно'} />
            <hr className="divider" /><Total label="Доставка" value={rub(deliveryAll)} />
            <p className="mt-2 text-xs text-muted">Ориентир получения: {fmtRange(w.arrival_from, w.arrival_to)}.</p></div>
          <div className="card-soft"><h3 className="h3 mb-4">Ваш заказ</h3>
            <Summary items={items}><Kv k="Доставка и упаковка" v={rub(deliveryAll)} />{q.gift_rub > 0 && <Kv k="Подарочная коробка" v={rub(q.gift_rub)} />}<hr className="divider" /><Total label="Итого" value={rub(q.total_rub)} /></Summary>
            <button className="btn btn-primary mt-4 w-full" onClick={() => router.push('/checkout/form')}>Перейти к оформлению</button>
            <p className="mt-3 text-xs text-muted">Пример расчёта. Сейчас деньги не списываются.</p></div>
        </>}
      />
    </div>
  );
}
