'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AdminHead, paginate, Pager, Panel, WAVE_PILL, waveUrl } from '@/features/admin/ui';
import { useShop } from '@/features/shop/store';
import { get } from '@/shared/api/client';
import type { Wave, WaveStatus } from '@/shared/api/types';
import { cn, fmtDate, fmtRange, kg } from '@/shared/lib/format';
import { Info } from '@/features/account/parts';
import { FillBar } from '@/shared/ui';

export default function WavesAdmin() {
  const { meta } = useShop();
  const [list, setList] = useState<Wave[] | null>(null);
  const [q, setQ] = useState('');
  const [dir, setDir] = useState('');
  const [st, setSt] = useState<WaveStatus | ''>('');
  const [withOrders, setWithOrders] = useState(false);
  const [page, setPage] = useState(1);
  useEffect(() => { get<Wave[]>('/api/admin/waves').then(setList).catch(() => setList([])); }, []);
  const filtered = useMemo(() => (list || []).filter((w) => (!dir || w.direction === dir) && (!st || w.status === st)
    && (!withOrders || w.orders_count > 0) && (!q.trim() || `${w.title} ${fmtDate(w.departure)} ${w.id}`.toLowerCase().includes(q.trim().toLowerCase()))), [list, dir, st, withOrders, q]);
  const { rows, pages, page: cur } = paginate(filtered, page);
  const count = (s: WaveStatus) => (list || []).filter((w) => w.status === s).length;
  const max = meta.policy.max_load_kg;
  const focus = (list || []).find((w) => w.status === 'collecting' && w.orders_count > 0) || (list || []).find((w) => w.status === 'collecting');

  return (
    <>
      <AdminHead title="Сборные партии" text="Партии формируются по расписанию: приём заказов закрывается автоматически, статусы меняются вручную." />
      <Panel>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="field"><span className="label">Поиск по партиям</span><input className="input" placeholder="Направление или дата" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></label>
          <label className="field"><span className="label">Статус</span><select className="select" value={st} onChange={(e) => { setSt(e.target.value as WaveStatus | ''); setPage(1); }}><option value="">Все статусы</option>{(Object.keys(WAVE_PILL) as WaveStatus[]).map((k) => <option key={k} value={k}>{WAVE_PILL[k]}</option>)}</select></label>
          <label className="field"><span className="label">Направление</span><select className="select" value={dir} onChange={(e) => { setDir(e.target.value); setPage(1); }}><option value="">Все направления</option>{Object.values(meta.directions).map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}</select></label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={cn('pill', !withOrders && 'pill-soft')} onClick={() => { setWithOrders(!withOrders); setPage(1); }}>Только с заказами</button>
          <button type="button" className="pill pill-soft" onClick={() => { setQ(''); setDir(''); setSt(''); setWithOrders(false); setPage(1); }}>Сбросить фильтры</button>
        </div>
      </Panel>
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" className={cn('pill', st && 'pill-soft')} onClick={() => setSt('')}>Все · {list?.length ?? 0}</button>
        {(Object.keys(WAVE_PILL) as WaveStatus[]).map((k) => <button key={k} type="button" className={cn('pill', st !== k && 'pill-soft')} onClick={() => { setSt(k); setPage(1); }}>{WAVE_PILL[k]} · {count(k)}</button>)}
      </div>
      <div className="mt-4 overflow-x-auto">
        {!list ? <p className="text-muted">Загружаем…</p> : (
          <table className="table-x min-w-[900px]">
            <thead><tr><th>Отправка</th><th>Направление</th><th>Заказов</th><th>Загрузка</th><th>Приём до</th><th>Прибытие</th><th>Тариф</th><th>Статус</th><th>Действие</th></tr></thead>
            <tbody>{rows.map((w) => (
              <tr key={w.id}>
                <td className="font-semibold whitespace-nowrap">{fmtDate(w.departure)}</td><td>{w.title}</td><td>{w.orders_count}</td>
                <td className="min-w-36"><FillBar load={w.load_kg} max={max} /><span className={cn('text-xs', w.load_kg < meta.policy.min_load_kg ? 'text-accent' : 'text-muted')}>{kg(w.load_kg)} из {max}</span></td>
                <td className="whitespace-nowrap">{fmtDate(w.cutoff)}</td>
                <td className="whitespace-nowrap">{fmtRange(w.arrival_from, w.arrival_to)}</td>
                <td className="whitespace-nowrap">{w.final_rate ?? w.rate} ₽/кг</td>
                <td>{WAVE_PILL[w.status]}</td>
                <td><Link className="text-accent" href={waveUrl(w)}>{w.status === 'done' ? 'История' : 'Подробнее'}</Link></td>
              </tr>
            ))}{!rows.length && <tr><td colSpan={9} className="text-muted">Партий не найдено</td></tr>}</tbody>
          </table>
        )}
      </div>
      <Pager page={cur} pages={pages} total={filtered.length} shown={rows.length} onPage={setPage} />
      {focus && (
        <Panel className="mt-6" title={`Ближайшая партия · ${focus.title}`}>
          <p className="text-sm">Отправка {fmtDate(focus.departure)} · приём до {fmtDate(focus.cutoff)} · {focus.orders_count} заказов · {kg(focus.load_kg)}</p>
          <FillBar load={focus.load_kg} max={max} />
          <div className="mt-5 flex flex-wrap gap-3"><Link className="btn btn-primary" href={waveUrl(focus)}>Подробности партии</Link><Link className="btn" href={`/admin/orders?wave=${encodeURIComponent(focus.id)}`}>Заказы партии</Link></div>
        </Panel>
      )}
      <Info className="mt-6 text-[13px]">«Готова к отправке» фиксирует загрузку и пересчитывает доставку всех заказов по итоговому тарифу (цена только снижается). Если партия не набрала {meta.policy.min_load_kg} кг, её можно перенести — заказы перейдут в следующую.</Info>
    </>
  );
}
