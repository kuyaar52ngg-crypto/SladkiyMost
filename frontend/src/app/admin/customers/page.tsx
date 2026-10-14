'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { AdminHead, paginate, Pager, Panel } from '@/features/admin/ui';
import { useShop } from '@/features/shop/store';
import { get, post } from '@/shared/api/client';
import type { Customer, Ticket, TicketStatus } from '@/shared/api/types';
import { cn, fmtDate, rub } from '@/shared/lib/format';

const STATUS: Record<TicketStatus, string> = { open: 'Новое', in_work: 'В работе', answered: 'Ответ дан', closed: 'Закрыто' };
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('ru-RU') : '—');

function TicketPanel({ t, onChange }: { t: Ticket; onChange: () => void }) {
  const { toast } = useShop();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const act = async (path: string, body: object, ok: string) => {
    setBusy(true);
    try { await post(`/api/admin/tickets/${t.number}/${path}`, body); toast(ok); setText(''); onChange(); }
    catch (e) { toast((e as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <Panel title={`${t.code} · содержание`}>
      <span className={cn('pill', t.status === 'closed' && 'pill-soft')}>{t.status_title}</span>
      <p className="mt-3 text-sm font-semibold">{t.customer_name} · {fmtDate(t.created_at, true)}</p>
      <p className="text-xs text-muted">{t.customer_phone} · {t.topic}{t.order_code && <> · <Link className="text-accent" href={`/admin/orders/${encodeURIComponent(t.order_code)}`}>{t.order_code}</Link></>}{t.assignee && ` · ответственный: ${t.assignee}`}</p>
      <div className="mt-4 max-h-80 space-y-3 overflow-y-auto">
        {t.messages.map((m, i) => (
          <div key={i} className={cn('rounded-card p-3 text-sm', m.author === 'support' ? 'ml-6 bg-pink' : 'mr-6 bg-[#faf8f7]')}>
            <b className="block text-xs">{m.author === 'support' ? `Поддержка · ${m.name}` : m.name}{m.created_at && ` · ${new Date(m.created_at).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`}</b>
            <p className="mt-1 whitespace-pre-wrap">{m.text}</p>
          </div>
        ))}
      </div>
      <label className="field mt-4"><span className="label">Ответ покупателю</span>
        <textarea className="input min-h-[100px]" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ответ придёт покупателю в кабинет и в Telegram" /></label>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" className="btn btn-primary" disabled={busy || !text.trim()} onClick={() => act('messages', { text }, 'Ответ отправлен')}>Отправить ответ</button>
        {t.status === 'open' && <button type="button" className="btn" disabled={busy} onClick={() => act('status', { status: 'in_work' }, 'Взято в работу')}>Взять в работу</button>}
        {t.status !== 'closed' && <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => act('status', { status: 'closed' }, 'Обращение закрыто')}>Закрыть</button>}
      </div>
    </Panel>
  );
}

function Customers() {
  const sp = useSearchParams();
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [tab, setTab] = useState<'tickets' | 'customers'>(sp.get('tab') === 'customers' ? 'customers' : 'tickets');
  const [q, setQ] = useState('');
  const [st, setSt] = useState<TicketStatus | ''>('');
  const [cq, setCq] = useState('');
  const [page, setPage] = useState(1);
  const load = useCallback(() => {
    get<Ticket[]>('/api/admin/tickets').then(setTickets).catch(() => setTickets([]));
    get<Customer[]>('/api/admin/customers').then(setCustomers).catch(() => setCustomers([]));
  }, []);
  useEffect(load, [load]);
  const filtered = useMemo(() => (tickets || []).filter((t) => (!st || t.status === st)
    && (!q.trim() || `${t.code} ${t.customer_name} ${t.customer_phone} ${t.topic} ${t.order_code}`.toLowerCase().includes(q.trim().toLowerCase()))), [tickets, st, q]);
  const { rows, pages, page: cur } = paginate(filtered, page, 10);
  const selected = tickets?.find((t) => String(t.number) === sp.get('ticket')) || filtered[0];
  const people = (customers || []).filter((c) => !cq.trim() || `${c.name} ${c.phone} ${c.email || ''}`.toLowerCase().includes(cq.trim().toLowerCase()));
  const openCount = (tickets || []).filter((t) => t.status === 'open' || t.status === 'in_work').length;

  return (
    <>
      <AdminHead title="Покупатели и обращения" />
      <div className="mb-5 flex flex-wrap gap-2">
        <button type="button" className={cn('pill', tab !== 'tickets' && 'pill-soft')} onClick={() => setTab('tickets')}>Обращения · {openCount} в работе</button>
        <button type="button" className={cn('pill', tab !== 'customers' && 'pill-soft')} onClick={() => setTab('customers')}>Покупатели · {customers?.length ?? 0}</button>
      </div>

      {tab === 'tickets' ? (
        <>
          <Panel>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="field"><span className="label">Поиск по обращениям</span><input className="input" placeholder="Номер, покупатель, тема или заказ" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></label>
              <label className="field"><span className="label">Статус</span><select className="select" value={st} onChange={(e) => { setSt(e.target.value as TicketStatus | ''); setPage(1); }}><option value="">Все статусы</option>{(Object.keys(STATUS) as TicketStatus[]).map((s) => <option key={s} value={s}>{STATUS[s]}</option>)}</select></label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className={cn('pill', st !== 'open' && 'pill-soft')} onClick={() => setSt(st === 'open' ? '' : 'open')}>Требуют ответа</button>
              <button type="button" className="pill pill-soft" onClick={() => { setQ(''); setSt(''); }}>Сбросить фильтры</button>
            </div>
          </Panel>
          <div className="mt-5 overflow-x-auto">
            {!tickets ? <p className="text-muted">Загружаем…</p> : (
              <table className="table-x min-w-[820px]">
                <thead><tr><th>Номер</th><th>Покупатель</th><th>Тема / заказ</th><th>Статус</th><th>Дата</th><th>Ответственный</th><th>Действие</th></tr></thead>
                <tbody>{rows.map((t) => (
                  <tr key={t.number} className={cn(t === selected && 'bg-pink/60')}>
                    <td className="font-semibold">{t.code}</td><td>{t.customer_name}</td>
                    <td>{t.topic}{t.order_code && <span className="block text-xs text-muted">{t.order_code}</span>}</td>
                    <td>{t.status_title}</td><td className="whitespace-nowrap">{day(t.created_at)}</td><td>{t.assignee || 'Не назначен'}</td>
                    <td><button type="button" className="text-accent" onClick={() => router.replace(`/admin/customers?ticket=${t.number}`)}>{t.status === 'closed' ? 'История' : 'Открыть'}</button></td>
                  </tr>
                ))}{!rows.length && <tr><td colSpan={7} className="text-muted">Обращений нет</td></tr>}</tbody>
              </table>
            )}
          </div>
          <Pager page={cur} pages={pages} total={filtered.length} shown={rows.length} onPage={setPage} />
          {selected && <div className="mt-6 max-w-[720px]"><TicketPanel key={selected.number} t={selected} onChange={load} /></div>}
        </>
      ) : (
        <Panel title="Покупатели">
          <label className="field max-w-[420px]"><span className="label">Поиск покупателя</span><input className="input" placeholder="Имя, телефон или почта" value={cq} onChange={(e) => setCq(e.target.value)} /></label>
          <div className="mt-4 overflow-x-auto">
            <table className="table-x min-w-[760px]">
              <thead><tr><th>Имя</th><th>Контакт</th><th>Заказов</th><th>Активных</th><th>Сумма</th><th>Последний заказ</th><th>Telegram</th></tr></thead>
              <tbody>{people.map((c) => (
                <tr key={c.id}>
                  <td className="font-semibold">{c.name}<span className="block text-xs font-normal text-muted">с {day(c.created_at)}</span></td>
                  <td>{c.phone}{c.email && <span className="block text-xs text-muted">{c.email}</span>}</td>
                  <td>{c.orders}</td><td>{c.active_orders}</td><td className="whitespace-nowrap">{rub(c.spent_rub)}</td>
                  <td>{c.last_order ? <Link className="text-accent" href={`/admin/orders/${encodeURIComponent(c.last_order)}`}>{c.last_order}</Link> : '—'}</td>
                  <td>{c.telegram ? 'подключён' : '—'}</td>
                </tr>
              ))}{!people.length && <tr><td colSpan={7} className="text-muted">{customers ? 'Покупателей не найдено' : 'Загружаем…'}</td></tr>}</tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">Только данные для обработки заказов. Пароли и платёжные данные не хранятся в открытом виде.</p>
        </Panel>
      )}
    </>
  );
}

export default function Page() {
  return <Suspense><Customers /></Suspense>;
}
