'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useShop } from '@/features/shop/store';
import { TelegramConnect } from '@/features/telegram/TelegramConnect';
import { useLive } from '@/shared/lib/live';
import { get, post } from '@/shared/api/client';
import { localLink } from '@/features/account/parts';
import { AdminHead, Bars, Kpi, orderUrl, Panel, WAVE_PILL, waveName, waveUrl } from '@/features/admin/ui';
import type { Notice, Order, OrderStatus, Product, Stats, Ticket, Wave, WaveStatus } from '@/shared/api/types';
import { cn, fmtDate, kg, plural, rub } from '@/shared/lib/format';
import { FillBar } from '@/shared/ui';

/** Уведомления: регистрация вебхука бота (один раз после деплоя) и привязка своего чата. */
function TelegramCard() {
  const { toast } = useShop();
  const [bot, setBot] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  useEffect(() => { get<{ username: string | null }>('/api/admin/telegram').then((r) => setBot(r.username)).catch(() => setBot(null)); }, []);
  const setup = async () => {
    setBusy(true);
    try { const r = await post<{ username: string }>('/api/admin/telegram/setup'); setBot(r.username); toast(`Бот @${r.username} подключён`); }
    catch (e) { toast((e as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <div className="mt-6 grid items-center gap-4 rounded-card border border-line p-5 sm:p-6 md:grid-cols-[1fr_auto_auto]">
      <div><h3 className="h3">Уведомления в Telegram</h3>
        <p className="mt-1.5 text-[13px] text-muted">{bot ? <>Бот <b>@{bot}</b> присылает новые заказы, отмены и статусы партий.</> : 'Подключите бота, чтобы получать новые заказы и статусы партий.'}</p></div>
      <button className="btn" onClick={setup} disabled={busy}>{busy ? 'Подключаем…' : bot ? 'Переподключить бота' : 'Подключить бота'}</button>
      {bot && <TelegramConnect className="md:w-auto" />}
    </div>
  );
}

const ACTIVE: OrderStatus[] = ['accepted', 'assembling', 'transit', 'pickup'];
const time = (iso: string) => new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' ·');

export default function Dashboard() {
  const { meta } = useShop();
  const [s, setS] = useState<Stats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [waves, setWaves] = useState<Wave[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [feed, setFeed] = useState<Notice[]>([]);
  const load = useCallback(() => {
    get<Stats>('/api/admin/stats').then(setS).catch(() => null);
    get<Order[]>('/api/admin/orders').then(setOrders).catch(() => null);
    get<Wave[]>('/api/admin/waves').then(setWaves).catch(() => null);
    get<Ticket[]>('/api/admin/tickets').then(setTickets).catch(() => null);
    get<Product[]>('/api/admin/products').then(setProducts).catch(() => null);
    get<Notice[]>('/api/account/notifications').then(setFeed).catch(() => null);
  }, []);
  useEffect(load, [load]);
  useLive(load);
  if (!s) return <p className="text-muted">Загружаем…</p>;

  const active = orders.filter((o) => ACTIVE.includes(o.status));
  const openTickets = tickets.filter((t) => t.status === 'open' || t.status === 'in_work');
  const live = waves.filter((w) => ['collecting', 'closed', 'transit', 'arrived'].includes(w.status))
    .sort((a, b) => Number(b.orders_count > 0) - Number(a.orders_count > 0) || a.departure.localeCompare(b.departure)).slice(0, 6);
  const lowLoad = waves.filter((w) => w.status === 'collecting' && w.days_left <= 3 && w.orders_count > 0);
  const SHORT: Record<OrderStatus, string> = { accepted: 'Объединение', assembling: 'Сборка', transit: 'В пути', pickup: 'Выдача', received: 'Получен', cancelled: 'Отменён' };
  const stages: [string, number][] = (Object.keys(SHORT) as OrderStatus[]).map((st) => [SHORT[st], s.by_status[st] || 0]);
  const peak = stages.reduce((m, [, v], i) => (v > stages[m][1] ? i : m), 0);
  const attention = [
    ...lowLoad.map((w) => [`${waveName(w)} — закрытие приёма через ${w.days_left} дн.`, `${w.orders_count} ${plural(w.orders_count, 'заказ', 'заказа', 'заказов')} · ${kg(w.load_kg)}`, waveUrl(w)]),
    ...openTickets.slice(0, 3).map((t) => [`${t.code} · ${t.topic}`, `${t.customer_name}${t.order_code ? ` · ${t.order_code}` : ''} · ${t.status_title.toLowerCase()}`, `/admin/customers?ticket=${t.number}`]),
    ...orders.filter((o) => o.status === 'accepted' && !o.wave?.open).slice(0, 2).map((o) => [`${o.code} — приём в партию закрыт, заказ ещё не в сборке`, `${o.customer_name} · ${rub(o.total_rub)}`, orderUrl(o)]),
  ];

  return (
    <>
      <AdminHead title="Дашборд" text="Заказы, сборные партии и обращения покупателей — в одном месте." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Kpi title="Заказы" value={s.orders} hint={`Оборот ${rub(s.revenue)}`} />
        <Kpi title="В обработке" value={active.length} hint="Ожидают отправки или в пути" />
        <Kpi title="Обращения" value={openTickets.length} hint={openTickets.length ? 'Ждут ответа поддержки' : 'Все отвечены'} />
        <Kpi title="Товары" value={products.filter((p) => p.active).length} hint={`${products.filter((p) => !p.active).length} скрыто с витрины`} />
      </div>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <Panel title="Активность · заказы по этапам">
          <span className="pill">заказы</span>
          <div className="mt-5"><Bars data={stages} accent={peak} /></div>
          <p className="mt-3 text-xs text-muted">Шкала — количество заказов на каждом этапе.</p>
        </Panel>
        <Panel title="Требуют внимания">
          <span className={cn('pill', !attention.length && 'pill-soft')}>{attention.length ? `${attention.length} ${plural(attention.length, 'задача', 'задачи', 'задач')}` : 'Всё спокойно'}</span>
          <ul className="mt-4 space-y-3">
            {attention.slice(0, 5).map(([t, d, href]) => (
              <li key={t}><Link href={href} className="block font-semibold hover:text-accent">{t}</Link><span className="text-[13px] text-muted">{d}</span></li>
            ))}
            {!attention.length && <li className="text-[13px] text-muted">Нет партий на грани закрытия и неотвеченных обращений.</li>}
          </ul>
          <div className="mt-5 flex flex-wrap gap-3"><Link className="btn btn-primary" href="/admin/waves">Открыть партии</Link><Link className="btn" href="/admin/customers">Открыть обращения</Link></div>
        </Panel>
      </div>

      <Panel className="mt-6" title="Состояние сборных партий" action={<Link className="text-[13px] text-accent" href="/admin/waves">Все партии</Link>}>
        <div className="overflow-x-auto">
          <table className="table-x min-w-[720px]">
            <thead><tr><th>Партия</th><th>Направление</th><th>Заказов</th><th>Загрузка</th><th>Отправка</th><th>Статус</th><th>Действие</th></tr></thead>
            <tbody>{live.map((w, i) => (
              <tr key={w.id} className={cn(i === 0 && 'bg-pink/60')}>
                <td className="font-semibold">{fmtDate(w.departure)}</td><td>{w.title}</td><td>{w.orders_count}</td>
                <td>{kg(w.load_kg)} · {Math.round(w.fill * 100)}%</td><td>{fmtDate(w.departure)}</td><td>{WAVE_PILL[w.status]}</td>
                <td><Link className="text-accent" href={waveUrl(w)}>Подробнее</Link></td>
              </tr>
            ))}{!live.length && <tr><td colSpan={7} className="text-muted">Нет активных партий</td></tr>}</tbody>
          </table>
        </div>
      </Panel>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <Panel title="Последние действия">
          {feed.length ? (
            <div className="overflow-x-auto">
              <table className="table-x min-w-[440px]">
                <thead><tr><th>Время</th><th>Событие</th></tr></thead>
                <tbody>{feed.slice(0, 6).map((n) => (
                  <tr key={n.id}><td className="whitespace-nowrap">{time(n.created_at)}</td>
                    <td>{n.link ? <Link className="text-accent" href={localLink(n.link)}>{n.title}</Link> : n.title}<span className="block text-xs text-muted">{n.body}</span></td></tr>
                ))}</tbody>
              </table>
            </div>
          ) : <p className="text-[13px] text-muted">Новые заказы, отмены и обращения появятся здесь.</p>}
        </Panel>
        <Panel title="Операционная сводка">
          <p className="text-[15px]">{(Object.keys(WAVE_PILL) as WaveStatus[]).map((st) => [WAVE_PILL[st], waves.filter((w) => w.status === st && w.orders_count > 0).length] as const).filter(([, n]) => n).map(([t, n]) => `${n} · ${t.toLowerCase()}`).join(' · ') || 'Партий с заказами пока нет.'}</p>
          <div className="mt-3 divide-y divide-line text-sm">
            <div className="kv"><span>Средний чек</span><b>{rub(s.avg_check)}</b></div>
            <div className="kv"><span>Подарочных заказов</span><b>{s.gifts}</b></div>
            <div className="kv"><span>Комиссия платформы</span><b>{rub(s.commission)}</b></div>
          </div>
          {s.counter.map((c) => c.wave && (
            <div key={c.direction} className="mt-4"><div className="flex justify-between text-[13px]"><span>{c.title}</span><span className="text-muted">отправка {fmtDate(c.wave.departure)}</span></div>
              <FillBar load={c.wave.load_kg} max={meta.policy.max_load_kg} /></div>
          ))}
        </Panel>
      </div>
      <TelegramCard />
    </>
  );
}
