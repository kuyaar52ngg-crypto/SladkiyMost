'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { useOrders, useTickets } from '@/features/account/data';
import { AccountHead } from '@/features/account/page';
import { Card } from '@/features/account/parts';
import { useShop } from '@/features/shop/store';
import { get, post } from '@/shared/api/client';
import type { Ticket } from '@/shared/api/types';
import { cn, fmtDate } from '@/shared/lib/format';

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('ru-RU') : '');

function TicketView({ t, onChange }: { t: Ticket; onChange: () => void }) {
  const { toast } = useShop();
  const [text, setText] = useState('');
  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    try { await post(`/api/account/tickets/${t.number}/messages`, { text }); setText(''); onChange(); }
    catch (ex) { toast((ex as Error).message); }
  };
  return (
    <Card title={`Обращение ${t.code}`}>
      <span className={cn('pill', t.status === 'closed' && 'pill-soft')}>{t.status_title}</span>
      <p className="mt-4 text-[13px] text-muted">{fmtDate(t.created_at, true)} · {t.topic}{t.order_code && ` · ${t.order_code}`}{t.assignee && ` · ответственный: ${t.assignee}`}</p>
      <div className="mt-4 space-y-4">
        {t.messages.map((m, i) => (
          <div key={i}>
            <b className="block text-[15px]">{m.author === 'support' ? `Поддержка · ${m.name}` : 'Ваш вопрос'}</b>
            <p className="mt-1.5 text-[15px] whitespace-pre-wrap">{m.text}</p>
          </div>
        ))}
        {t.status !== 'answered' && t.status !== 'closed' && <p className="text-[13px] text-muted">Ответим в рабочее время. Ответ придёт в уведомления{' '}и в Telegram, если он подключён.</p>}
      </div>
      {t.status !== 'closed' && (
        <form onSubmit={send} className="mt-5 space-y-3">
          <textarea className="input min-h-[90px]" aria-label="Сообщение" placeholder="Дополнить обращение" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn" disabled={!text.trim()}>Отправить</button>
        </form>
      )}
    </Card>
  );
}

function Support() {
  const { toast } = useShop();
  const sp = useSearchParams();
  const router = useRouter();
  const [tickets, reload] = useTickets();
  const [orders] = useOrders();
  const [topics, setTopics] = useState<string[]>([]);
  const [v, setV] = useState({ order_code: sp.get('order') || '', topic: '', text: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { get<string[]>('/api/account/tickets/topics').then((t) => { setTopics(t); setV((x) => ({ ...x, topic: x.topic || t[0] })); }).catch(() => null); }, []);
  const selected = tickets?.find((t) => String(t.number) === sp.get('ticket')) || tickets?.[0];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!v.text.trim()) { setErr('Опишите вопрос'); return; }
    setBusy(true);
    try {
      const t = await post<Ticket>('/api/account/tickets', v);
      setV({ ...v, text: '' }); setErr(''); toast(`Обращение ${t.code} отправлено`);
      reload(); router.replace(`/account/support?ticket=${t.number}`);
    } catch (ex) { setErr((ex as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <>
      <Card title="Мои обращения">
        {!tickets ? <p className="text-muted">Загружаем…</p> : tickets.length ? (
          <div className="overflow-x-auto">
            <table className="table-x min-w-[600px]">
              <thead><tr><th>Номер / дата</th><th>Тема</th><th>Заказ</th><th>Статус</th></tr></thead>
              <tbody>{tickets.map((t) => (
                <tr key={t.number} onClick={() => router.replace(`/account/support?ticket=${t.number}`)} className={cn('cursor-pointer hover:bg-pink/60', t === selected && 'bg-pink/60')}>
                  <td className="font-semibold">{t.code} · {day(t.created_at)}</td><td>{t.topic}</td><td>{t.order_code || '—'}</td>
                  <td className={t.status === 'closed' ? 'text-muted' : 'text-accent'}>{t.status_title}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p className="text-[15px] text-muted">Обращений пока нет. Задайте вопрос — ответим в кабинете и в Telegram.</p>}
      </Card>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <form onSubmit={submit} noValidate className="rounded-card border border-line p-6">
          <h2 className="h3 mb-5">Новое обращение</h2>
          <div className="space-y-4">
            <label className="field"><span className="label">Связанный заказ</span>
              <select className="select" value={v.order_code} onChange={(e) => setV({ ...v, order_code: e.target.value })}>
                <option value="">Без заказа</option>
                {(orders || []).map((o) => <option key={o.code} value={o.code}>№ {o.code} · {fmtDate(o.created_at)}</option>)}
              </select></label>
            <label className="field"><span className="label">Тема *</span>
              <select className="select" value={v.topic} onChange={(e) => setV({ ...v, topic: e.target.value })}>
                {topics.map((t) => <option key={t}>{t}</option>)}
              </select></label>
            <label className="field"><span className="label">Сообщение *</span>
              <textarea className={cn('input min-h-[140px]', err && !v.text.trim() && 'input-invalid')} placeholder="Например: когда будет известна дата доставки?" value={v.text} onChange={(e) => setV({ ...v, text: e.target.value })} /></label>
          </div>
          {err && <p role="alert" className="mt-4 text-[13px] text-accent">{err}</p>}
          <button className="btn btn-primary mt-6" disabled={busy}>{busy ? 'Отправляем…' : 'Отправить обращение'}</button>
          <p className="mt-3 text-[13px] text-muted">Ответ придёт в раздел «Уведомления».</p>
        </form>
        {selected && <TicketView key={selected.number} t={selected} onChange={reload} />}
      </div>
    </>
  );
}

export default function SupportPage() {
  return (
    <>
      <AccountHead title="Поддержка" text="Поможем с заказом, сборной отправкой и данными получателя." />
      <Suspense><Support /></Suspense>
    </>
  );
}
