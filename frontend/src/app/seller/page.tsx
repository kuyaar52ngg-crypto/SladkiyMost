'use client';
import Link from 'next/link';
import { AdminHead, Bars, Kpi, Panel, WAVE_PILL } from '@/features/admin/ui';
import { IN_WORK, sellerOrderUrl, useShopOrders, useShopProducts, useShopWaves } from '@/features/seller/data';
import { useSellerShop } from '@/features/seller/context';
import { cn, fmtDate, kg, plural, rub } from '@/shared/lib/format';

const WEEK = 7 * 86400000;

export default function SellerOverview() {
  const { shop } = useSellerShop();
  const [orders] = useShopOrders();
  const [products] = useShopProducts();
  const [waves] = useShopWaves();
  if (!orders || !products) return <p className="text-muted">Загружаем…</p>;
  const live = orders.filter((o) => o.order.status !== 'cancelled');
  const goods = live.reduce((s, o) => s + o.order.goods_rub, 0);
  const now = Date.now();
  const weeks: [string, number][] = [4, 3, 2, 1, 0].map((k) => {
    const from = now - (k + 1) * WEEK, to = now - k * WEEK;
    const sum = live.filter((o) => { const t = new Date(o.order.created_at).getTime(); return t > from && t <= to; }).reduce((s, o) => s + o.order.goods_rub, 0);
    return [k ? `${k} нед. назад` : 'Эта неделя', Math.round(sum / 100) / 10];
  });
  const fresh = live.filter((o) => o.prep_status === 'new');
  const work = live.filter((o) => IN_WORK.includes(o.prep_status));
  const drafts = products.filter((p) => !p.active && !p.review);
  const top = new Map<string, [string, number, number]>();
  live.forEach((o) => o.order.items.forEach((i) => { const t = top.get(i.id) || [i.name, 0, 0]; top.set(i.id, [i.name, t[1] + i.qty, t[2] + i.qty * i.price_rub]); }));
  const tasks: [string, string, string][] = [
    ...fresh.slice(0, 3).map((o) => [`Подтвердить ${o.order.code}`, o.order.items.map((i) => `${i.name} × ${i.qty}`).join(', ') + ` · ${rub(o.order.goods_rub)}`, sellerOrderUrl(o.order.code)] as [string, string, string]),
    ...work.slice(0, 2).map((o) => [`${o.prep_title}: ${o.order.code}`, o.order.wave ? `Партия ${o.order.wave.title}, отправка ${fmtDate(o.order.wave.departure)}` : '', sellerOrderUrl(o.order.code)] as [string, string, string]),
    ...drafts.slice(0, 2).map((p) => [`Завершить карточку «${p.name}»`, 'Черновик — товар не опубликован', `/seller/products/${p.id}`] as [string, string, string]),
  ];
  const nextWave = (waves || []).find((w) => w.status === 'collecting') || (waves || [])[0];

  return (
    <>
      <AdminHead title="Обзор магазина" crumb={[['Кабинет поставщика', '/seller'], ['Обзор магазина']]} text={`Товары и заказы магазина «${shop.name}».`} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Kpi title="Новые заказы" value={fresh.length} hint="Ожидают подтверждения" />
        <Kpi title="В обработке" value={work.length} hint="Подтверждены, готовятся, ждут передачи" />
        <Kpi title="Активные товары" value={products.filter((p) => p.active).length} hint={`Из ${products.length} товаров магазина`} />
        <Kpi title="Заказы за товары" value={rub(goods)} hint="Без доставки, без отменённых" />
      </div>
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <Panel title="Продажи за период"><span className="pill">тыс. ₽</span><div className="mt-5"><Bars data={weeks} /></div><p className="mt-3 text-xs text-muted">Сумма ваших позиций в заказах по неделям.</p></Panel>
        <Panel title="Задачи на сегодня">
          <span className={cn('pill', !tasks.length && 'pill-soft')}>{tasks.length ? `${tasks.length} ${plural(tasks.length, 'задача', 'задачи', 'задач')}` : 'Всё сделано'}</span>
          <ul className="mt-4 space-y-3">{tasks.map(([t, d, href]) => <li key={t}><Link href={href} className="block font-semibold hover:text-accent">{t}</Link><span className="text-[13px] text-muted">{d}</span></li>)}
            {!tasks.length && <li className="text-[13px] text-muted">Новых заказов и незавершённых карточек нет.</li>}</ul>
          <Link className="btn btn-primary mt-5" href="/seller/orders">Открыть заказы</Link>
        </Panel>
      </div>
      <Panel className="mt-6" title="Последние заказы">
        <div className="overflow-x-auto"><table className="table-x min-w-[700px]">
          <thead><tr><th>Номер</th><th>Дата</th><th>Состав</th><th>Сумма</th><th>Получение</th><th>Статус</th><th>Действие</th></tr></thead>
          <tbody>{orders.slice(0, 5).map((o, i) => (
            <tr key={o.order.code} className={cn(i === 0 && 'bg-pink/60')}>
              <td className="font-semibold">{o.order.code}</td><td>{new Date(o.order.created_at).toLocaleDateString('ru-RU')}</td>
              <td>{o.order.items.map((x) => `${x.name} × ${x.qty}`).join(', ')}</td><td className="whitespace-nowrap">{rub(o.order.goods_rub)}</td>
              <td>{o.order.recipient.city}</td><td>{o.order.status === 'cancelled' ? 'Отменён' : o.prep_title}</td>
              <td><Link className="text-accent" href={sellerOrderUrl(o.order.code)}>{o.prep_status === 'new' ? 'Подтвердить' : 'Подробнее'}</Link></td>
            </tr>))}
            {!orders.length && <tr><td colSpan={7} className="text-muted">Заказов пока нет — они появятся, когда покупатели выберут ваши товары.</td></tr>}</tbody>
        </table></div>
      </Panel>
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <Panel title="Популярные товары">
          <table className="table-x"><thead><tr><th>Товар</th><th>Количество</th><th>Сумма</th></tr></thead>
            <tbody>{[...top.values()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n, q, s]) => <tr key={n}><td className="font-semibold">{n}</td><td>{q} шт.</td><td className="text-accent">{rub(s)}</td></tr>)}
              {!top.size && <tr><td colSpan={3} className="text-muted">Пока нет продаж</td></tr>}</tbody></table>
        </Panel>
        <Panel title="Сборные партии">
          {nextWave ? (<>
            <p className="font-semibold">{nextWave.title} · отправка {fmtDate(nextWave.departure)}</p>
            <span className={cn('pill mt-3', nextWave.status !== 'collecting' && 'pill-soft')}>{WAVE_PILL[nextWave.status]}</span>
            <p className="mt-3 text-sm">{nextWave.orders_count} {plural(nextWave.orders_count, 'заказ', 'заказа', 'заказов')} в партии · {kg(nextWave.load_kg)} · приём до {fmtDate(nextWave.cutoff)}</p>
            <p className="mt-2 text-xs text-muted">Объединение заказов и логистику ведёт площадка. Вы готовите только свои позиции.</p>
            <Link className="btn btn-primary mt-5" href="/seller/waves">Посмотреть партии</Link>
          </>) : <p className="text-sm text-muted">Ваших заказов в партиях пока нет.</p>}
        </Panel>
      </div>
    </>
  );
}
