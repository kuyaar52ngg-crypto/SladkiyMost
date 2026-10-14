'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useShop } from '@/features/shop/store';
import { get, post } from '@/shared/api/client';
import type { Wave, WaveStatus } from '@/shared/api/types';
import { fmtDate, fmtRange, kg } from '@/shared/lib/format';
import { FillBar, Note } from '@/shared/ui';

export default function WavesAdmin() {
  const { meta, toast } = useShop();
  const [list, setList] = useState<Wave[] | null>(null);
  const [dir, setDir] = useState('');
  const [st, setSt] = useState('');
  const load = useCallback(() => get<Wave[]>('/api/admin/waves').then(setList), []);
  useEffect(() => { load(); }, [load]);
  if (!list) return <p className="text-muted">Загружаем…</p>;
  const change = async (id: string, status: WaveStatus) => {
    try { await post(`/api/admin/waves/${id}/status`, { status }); toast(`Партия: ${meta.wave_statuses[status]}`); load(); }
    catch (e) { toast((e as Error).message); }
  };
  const max = meta.policy.max_load_kg;
  const shown = list.filter((w) => (!dir || w.direction === dir) && (!st || w.status === st));
  return (
    <>
      <div className="card mb-4 grid gap-4 sm:grid-cols-2">
        <label className="field"><span className="label">Направление</span><select className="select" value={dir} onChange={(e) => setDir(e.target.value)}><option value="">Все направления</option>{Object.values(meta.directions).map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}</select></label>
        <label className="field"><span className="label">Статус</span><select className="select" value={st} onChange={(e) => setSt(e.target.value)}><option value="">Все статусы</option>{Object.entries(meta.wave_statuses).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
      </div>
      <div className="overflow-x-auto rounded-card border border-line">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-soft text-left text-[13px]"><tr>{['Отправка', 'Направление', 'Сбор до', 'Прибытие', 'Загрузка', 'Тариф', 'Заказов', 'Статус'].map((h) => <th key={h} className="px-4 py-3.5 font-semibold">{h}</th>)}</tr></thead>
          <tbody>{shown.map((w) => (
            <tr key={w.id} className="border-t border-line [&>td]:px-4 [&>td]:py-3">
              <td className="whitespace-nowrap"><b>{fmtDate(w.departure)}</b></td>
              <td>{w.title}</td>
              <td className="whitespace-nowrap">{fmtDate(w.cutoff)}</td>
              <td className="whitespace-nowrap">{fmtRange(w.arrival_from, w.arrival_to)}{w.off_season && <span className="tag tag-warn ml-1">+7</span>}</td>
              <td className="min-w-40"><FillBar load={w.load_kg} max={max} /><span className={`text-xs ${w.load_kg < meta.policy.min_load_kg ? 'text-accent' : 'text-muted'}`}>{kg(w.load_kg)} / {max}</span></td>
              <td className="whitespace-nowrap">{w.final_rate ? <><b>{w.final_rate}</b> итог</> : w.rate} ₽/кг</td>
              <td>{w.orders_count ? <Link className="text-accent" href={`/admin/orders?wave=${w.id}`}>{w.orders_count}</Link> : 0}</td>
              <td><select className="select min-h-9 w-auto py-1.5 text-[13px]" value={w.status} onChange={(e) => change(w.id, e.target.value as WaveStatus)}>{Object.entries(meta.wave_statuses).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Note>«Сбор закрыт» фиксирует загрузку и пересчитывает доставку всех заказов волны по итоговому тарифу (цена может только снизиться). Заказы → «В сборке».</Note>
        <Note>«Перенесена» — если партия не набрала {meta.policy.min_load_kg} кг: заказы переходят в следующую волну. «В пути» и «Прибыла» меняют статусы заказов автоматически.</Note>
      </div>
    </>
  );
}
