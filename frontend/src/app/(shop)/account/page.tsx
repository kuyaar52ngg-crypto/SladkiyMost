'use client';
import Link from 'next/link';
import { useAddresses, useOrders, useProducts } from '@/features/account/data';
import { FavCard } from '@/features/account/FavCard';
import { AccountHead } from '@/features/account/page';
import { ACTIVE, Card, Items, OrderPill, ORDER_PILL, units, WaveBlock } from '@/features/account/parts';
import { useShop } from '@/features/shop/store';
import { TelegramConnect } from '@/features/telegram/TelegramConnect';
import { cn, fmtDate, kg, plural, rub } from '@/shared/lib/format';

export default function AccountOverview() {
  const { user, favs } = useShop();
  const [orders] = useOrders();
  const [addresses] = useAddresses();
  const [products] = useProducts();
  if (!user) return null;
  const active = (orders || []).filter((o) => ACTIVE.includes(o.status));
  const waiting = active.filter((o) => o.status === 'accepted').length;
  const last = orders?.[0];
  const saved = (products || []).filter((p) => favs.includes(p.id)).slice(0, 2);
  const sameWave = last?.wave ? (orders || []).filter((o) => o.wave?.id === last.wave?.id && o.status !== 'cancelled').map((o) => o.code) : [];

  return (
    <>
      <AccountHead title={`Здравствуйте, ${user.name.split(' ')[0]}!`} crumb={`Здравствуйте, ${user.name.split(' ')[0]}!`}
        text="Ваши сладости, отправки и сохранённые вкусы — всё рядом." />

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {([
          ['Активные заказы', active.length, waiting ? `${waiting} ${plural(waiting, 'ожидает', 'ожидают', 'ожидают')} объединения` : 'Новых отправок нет', '/account/orders'],
          ['Избранное', favs.length, 'Любимые сладости', '/account/favorites'],
          ['Мои адреса', addresses?.length ?? 0, addresses?.length ? 'Для быстрого оформления' : 'Добавьте адрес получения', '/account/addresses'],
        ] as const).map(([t, n, s, href]) => (
          <Link key={t} href={href} className="rounded-card border border-line p-3 transition hover:border-line-strong sm:p-6">
            <span className="text-[13px] text-muted sm:text-[15px]">{t}</span>
            <b className="mt-2 block font-head text-2xl sm:mt-5 sm:text-[28px]">{orders ? n : '…'}</b>
            <span className="mt-4 hidden text-[13px] text-muted sm:block">{s}</span>
          </Link>
        ))}
      </div>

      {last ? (
        <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
          <Card title={`Последний заказ № ${last.code}`}>
            <OrderPill o={last} />
            <p className="mt-4 mb-4 text-[15px] text-muted">{fmtDate(last.created_at, true)} · {units(last)} шт. · {kg(last.weight_kg)}</p>
            <Items o={last} />
            <p className="mt-4 font-semibold">{rub(last.goods_rub)} за товары · доставка {rub(last.delivery_rub)}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link className="btn btn-primary" href="/account/orders">Мои заказы</Link>
              <Link className="btn" href={`/account/orders/${encodeURIComponent(last.code)}`}>Подробнее</Link>
            </div>
          </Card>
          <WaveBlock wave={last.wave} codes={sameWave} />
        </div>
      ) : orders && (
        <Card className="mt-6" title="Заказов пока нет">
          <p className="text-muted">Выберите сладости Якутии и Донбасса — заказ появится здесь, а статусы будут приходить в уведомления.</p>
          <Link className="btn btn-primary mt-5" href="/catalog">Выбрать сладости</Link>
        </Card>
      )}

      {orders && orders.length > 1 && (
        <Card className="mt-6" title="Недавние заказы">
          <div className="overflow-x-auto">
            <table className="table-x min-w-[560px]">
              <thead><tr><th>Номер</th><th>Состав</th><th>Товары</th><th>Статус</th></tr></thead>
              <tbody>{orders.slice(0, 5).map((o, i) => (
                <tr key={o.code} className={cn(i === 0 && 'bg-pink/60')}>
                  <td><Link className="font-semibold hover:text-accent" href={`/account/orders/${encodeURIComponent(o.code)}`}>{o.code}</Link></td>
                  <td>{o.items.map((x) => `${x.name} × ${x.qty}`).join(', ')}</td>
                  <td>{rub(o.goods_rub)}</td>
                  <td className="text-accent">{ORDER_PILL[o.status]}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Card>
      )}

      {saved.length > 0 && (
        <section className="mt-8">
          <div className="mb-5 flex items-end justify-between gap-4"><h2 className="h2">Сохранённые сладости</h2>
            {favs.length > 2 && <Link className="text-[15px] text-accent" href="/account/favorites">Все · {favs.length}</Link>}</div>
          <div className="grid gap-8 sm:grid-cols-2">{saved.map((p) => <FavCard key={p.id} p={p} />)}</div>
        </section>
      )}

      <Card className="mt-8" title="Ваш профиль">
        <p className="text-[15px]">{user.name} · {user.email || user.phone}</p>
        <p className="mt-2 text-[13px] text-muted">{user.telegram ? 'Уведомления о заказах приходят в Telegram.' : 'Подключите Telegram, чтобы получать статусы заказов в мессенджер.'}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link className="btn btn-primary" href="/catalog">Продолжить покупки</Link>
          <Link className="btn" href="/account/profile">Изменить профиль</Link>
          {!user.telegram && <TelegramConnect className="sm:w-auto" />}
        </div>
      </Card>
    </>
  );
}
