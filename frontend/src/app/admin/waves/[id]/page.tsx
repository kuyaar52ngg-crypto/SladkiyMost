'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { WaveForm } from '@/features/admin/WaveForm';
import { useCallback, useEffect, useState } from 'react';
import { Info, Row } from '@/features/account/parts';
import { AdminHead, ORDER_ADMIN, orderUrl, Panel, WAVE_PILL } from '@/features/admin/ui';
import { useShop } from '@/features/shop/store';
import { del, get, post } from '@/shared/api/client';
import { useLive } from '@/shared/lib/live';
import type { Order, Wave, WaveStatus } from '@/shared/api/types';
import { cn, fmtDate, fmtRange, kg, rub } from '@/shared/lib/format';
import { FillBar, Icon } from '@/shared/ui';

/** Следующий шаг партии и его смысл для заказов. */
const NEXT: Partial<Record<WaveStatus, [WaveStatus, string, string][]>> = {
  collecting: [['closed', 'Закрыть приём', 'Загрузка фиксируется, доставка пересчитывается по итоговому тарифу, заказы → «Готовится к отправке».'],
    ['postponed', 'Перенести партию', 'Заказы переходят в следующую партию того же направления.']],
  closed: [['transit', 'Передать в доставку', 'Заказы → «В пути».']],
  transit: [['arrived', 'Отметить прибытие', 'Заказы → «На пункте выдачи».']],
  arrived: [['done', 'Завершить партию', 'Партия закрывается, заказы остаются в истории.']],
};
const STAGES: WaveStatus[] = ['collecting', 'closed', 'transit', 'arrived', 'done'];

export default function AdminWave() {
  const id = decodeURIComponent(useParams<{ id: string }>().id);
  const { meta, toast } = useShop();
  const [w, setW] = useState<Wave | null | false>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [action, setAction] = useState<[WaveStatus, string, string] | null>(null);
  const [note, setNote] = useState('');
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState<Wave[] | null>(null);  // партии, куда можно перенести заказы
  const [moveTo, setMoveTo] = useState('');
  const router = useRouter();
  const load = useCallback(() => {
    get<Wave>(`/api/admin/waves/${encodeURIComponent(id)}`).then(setW).catch(() => setW(false));
    get<Order[]>(`/api/admin/orders?wave=${encodeURIComponent(id)}`).then(setOrders).catch(() => setOrders([]));
  }, [id]);
  useEffect(load, [load]);
  useLive(load);
  if (w === null) return <p className="text-muted">Загружаем…</p>;
  if (!w) return <><AdminHead title="Партия не найдена" crumb={[['Сборные партии', '/admin/waves'], [id]]} /><Link className="btn" href="/admin/waves">К партиям</Link></>;

  const live = orders.filter((o) => o.status !== 'cancelled');
  const goods = live.reduce((s, o) => s + o.goods_rub, 0);
  const net = live.reduce((s, o) => s + o.items.reduce((a, i) => a + (i.weight_g * i.qty) / 1000, 0), 0);
  const stage = STAGES.indexOf(w.status);
  const startRemove = () => {
    setEditing(false); setMoveTo('');
    get<Wave[]>('/api/admin/waves')
      .then((l) => setRemoving(l.filter((x) => x.direction === w.direction && x.id !== w.id && (!live.length || !['arrived', 'done'].includes(x.status)))
        .sort((a, b) => a.departure.localeCompare(b.departure))))
      .catch((e) => toast((e as Error).message));
  };
  const remove = async () => {
    setBusy(true);
    try {
      const r = await del<{ moved: number }>(`/api/admin/waves/${encodeURIComponent(w.id)}${moveTo ? `?move_to=${encodeURIComponent(moveTo)}` : ''}`);
      toast(r.moved ? `Партия удалена, заказов перенесено: ${r.moved}` : 'Партия удалена');
      router.replace('/admin/waves');
    } catch (e) { toast((e as Error).message); setBusy(false); }
  };
  const confirm = async () => {
    if (!action || !checked) return;
    setBusy(true);
    try { await post(`/api/admin/waves/${encodeURIComponent(w.id)}/status`, { status: action[0], note }); toast(`Партия: ${WAVE_PILL[action[0]]}`); setAction(null); setNote(''); setChecked(false); load(); }
    catch (e) { toast((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <>
      <AdminHead title={`Партия · ${fmtDate(w.departure)}`} crumb={[['Сборные партии', '/admin/waves'], [`${w.title} · ${fmtDate(w.departure)}`]]}>
        <div className="flex flex-wrap gap-2">
          {w.status !== 'done' && !editing && <button type="button" className="btn" onClick={() => { setEditing(true); setRemoving(null); }}>Изменить</button>}
          {!removing && <button type="button" className="btn" onClick={startRemove}>Удалить</button>}
        </div>
      </AdminHead>
      {editing && (
        <Panel className="mb-6" title="Изменить партию">
          <WaveForm wave={w} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); load(); }} />
        </Panel>
      )}
      {removing && (
        <Panel className="mb-6" title="Удалить партию?">
          <p className="text-sm">Партия исчезнет из расписания и со страницы «Сборная доставка» и не будет создана заново автоматически.</p>
          {orders.length > 0 && (
            <>
              <p className="mt-3 text-sm">В партии {live.length} активных заказ(ов){orders.length > live.length ? ` и ${orders.length - live.length} отменённых` : ''} — они будут перенесены вместе с историей, покупатели увидят перенос в заказе.</p>
              <label className="field mt-4 max-w-md"><span className="label">Перенести заказы в партию</span>
                <select className="select" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                  <option value="">Выберите партию</option>
                  {removing.map((x) => <option key={x.id} value={x.id}>{fmtDate(x.departure)} · {WAVE_PILL[x.status]} · {kg(x.load_kg)}</option>)}
                </select></label>
              {!removing.length && <p className="mt-2 text-[13px] text-accent">Нет подходящей партии этого направления — сначала добавьте её.</p>}
            </>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" className="btn btn-primary" disabled={busy || (orders.length > 0 && !moveTo)} onClick={remove}>{busy ? 'Удаляем…' : 'Удалить партию'}</button>
            <button type="button" className="btn" onClick={() => setRemoving(null)}>Отмена</button>
          </div>
        </Panel>
      )}
      <span className={cn('pill', w.status !== 'collecting' && 'pill-soft')}>{WAVE_PILL[w.status]}</span>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <Panel title="Параметры партии">
          <Row k="Направление" v={w.title} />
          <Row k="Приём заказов" v={w.open ? `до ${fmtDate(w.cutoff)} · ${w.days_left} дн.` : `закрыт ${fmtDate(w.cutoff)}`} />
          <Row k="Заказы" v={`${live.length}${orders.length > live.length ? ` (+${orders.length - live.length} отменено)` : ''}`} />
          <Row k="Товарный вес / с упаковкой" v={`${kg(net)} / ${kg(w.load_kg)}`} />
          <Row k="Тариф" v={`${w.final_rate ?? w.rate} ₽/кг${w.final_rate ? ' · итоговый' : ''}`} />
          <Row k="Отправка и прибытие" v={`${fmtDate(w.departure)} · ${fmtRange(w.arrival_from, w.arrival_to)}`} />
          <FillBar load={w.load_kg} max={meta.policy.max_load_kg} />
          <p className="mt-2 text-xs text-muted">Минимум для отправки {meta.policy.min_load_kg} кг · вместимость {meta.policy.max_load_kg} кг{w.off_season && ' · межсезонье +7 дней'}</p>
        </Panel>
        <Panel title="История партии">
          <ol className="space-y-4">
            {STAGES.map((s, i) => {
              const done = i < stage || w.status === 'done', now = i === stage && w.status !== 'done';
              return (
                <li key={s} className="flex gap-3">
                  <span className={cn('grid size-7 shrink-0 place-items-center rounded-full text-xs', done || now ? 'bg-accent text-white' : 'bg-[#faf8f7] text-muted')}>{done ? <Icon name="check" className="size-3.5" /> : i + 1}</span>
                  <div><b className={cn('block text-sm', now ? 'font-semibold' : 'font-normal')}>{WAVE_PILL[s]}{now && ' · текущий этап'}</b>
                    <span className="text-xs text-muted">{s === 'collecting' ? `приём до ${fmtDate(w.cutoff)}` : s === 'transit' ? `отправка ${fmtDate(w.departure)}` : s === 'arrived' ? `ориентир ${fmtRange(w.arrival_from, w.arrival_to)}` : ''}</span></div>
                </li>
              );
            })}
          </ol>
          {w.status === 'postponed' && <p className="mt-4 text-[13px] text-accent">Партия перенесена — заказы переведены в следующую.</p>}
        </Panel>
      </div>

      <Panel className="mt-6" title="Заказы партии">
        <div className="overflow-x-auto">
          <table className="table-x min-w-[760px]">
            <thead><tr><th>Заказ</th><th>Получатель</th><th>Состав</th><th>Шт.</th><th>Вес</th><th>Товары</th><th>Статус</th></tr></thead>
            <tbody>{orders.map((o) => (
              <tr key={o.code} className={cn(o.status === 'cancelled' && 'text-muted')}>
                <td className="font-semibold"><Link className="hover:text-accent" href={orderUrl(o)}>{o.code}</Link></td>
                <td>{o.recipient.name}<span className="block text-xs text-muted">{o.recipient.city}</span></td>
                <td>{o.items.map((i) => `${i.name} × ${i.qty}`).join(', ')}</td>
                <td>{o.items.reduce((s, i) => s + i.qty, 0)}</td><td className="whitespace-nowrap">{kg(o.weight_kg)}</td>
                <td className="whitespace-nowrap">{rub(o.goods_rub)}</td><td className="text-accent">{ORDER_ADMIN[o.status]}</td>
              </tr>
            ))}{!orders.length && <tr><td colSpan={7} className="text-muted">В партии пока нет заказов</td></tr>}</tbody>
          </table>
        </div>
        <p className="mt-3 text-sm font-semibold">Итого за товары: {rub(goods)}. Доставка не включена.</p>
      </Panel>

      {NEXT[w.status] && (
        <Panel className="mt-6" title={action ? `${action[1]}?` : 'Дальнейшие действия'}>
          {action ? (
            <>
              <span className="pill">Подтверждение ручного действия</span>
              <p className="mt-3 text-sm">{action[2]} Затронет заказов: {live.length}. Покупатели получат уведомление.</p>
              <label className="field mt-4"><span className="label">Причина / комментарий</span><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Например: партия набрала минимальный вес" /></label>
              <label className="check mt-4"><input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />Я проверил состав и понимаю последствия</label>
              <div className="mt-5 flex flex-wrap gap-3">
                <button type="button" className="btn btn-primary" disabled={!checked || busy} onClick={confirm}>{busy ? 'Сохраняем…' : `Подтвердить: ${action[1].toLowerCase()}`}</button>
                <button type="button" className="btn" onClick={() => { setAction(null); setChecked(false); }}>Отмена</button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap gap-3">
              {NEXT[w.status]!.map((a, i) => <button key={a[0]} type="button" className={cn('btn', i === 0 && 'btn-primary')} onClick={() => setAction(a)}>{a[1]}</button>)}
              <Link className="btn" href="/admin/waves">Вернуться к партиям</Link>
            </div>
          )}
        </Panel>
      )}
      <Info className="mt-6 text-[13px]">Изменения статуса партии сразу меняют статусы её заказов и отправляют уведомления покупателям.</Info>
    </>
  );
}
