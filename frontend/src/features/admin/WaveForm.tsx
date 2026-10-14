'use client';
import { useState, type FormEvent } from 'react';
import { useShop } from '@/features/shop/store';
import { post, put } from '@/shared/api/client';
import type { DirectionId, Wave } from '@/shared/api/types';

const shift = (iso: string, days: number) => {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Создание и правка сборной партии. Прибытие можно не указывать — посчитается по нормативу доставки. */
export function WaveForm({ wave, onSaved, onCancel }: { wave?: Wave; onSaved: (w: Wave) => void; onCancel: () => void }) {
  const { meta, toast } = useShop();
  const p = meta.policy;
  const [v, setV] = useState({
    direction: (wave?.direction || Object.keys(meta.directions)[0]) as DirectionId,
    departure: wave?.departure || '', cutoff: wave?.cutoff || '',
    arrival_from: wave?.arrival_from || '', arrival_to: wave?.arrival_to || '',
    base_load_kg: String(wave?.base_load_kg ?? 0),
  });
  const [cutoffTouched, setCutoffTouched] = useState(!!wave);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v, x: string) => setV((s) => ({ ...s, [k]: x }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!v.departure || !v.cutoff) { setErr('Укажите дату отправки и окончания приёма'); return; }
    if (v.cutoff > v.departure) { setErr('Приём заказов должен закончиться не позже отправки'); return; }
    if ((v.arrival_from && !v.arrival_to) || (!v.arrival_from && v.arrival_to)) { setErr('Укажите обе даты прибытия или оставьте обе пустыми'); return; }
    const load = Number(v.base_load_kg.replace(',', '.'));
    if (!Number.isFinite(load) || load < 0 || load > p.max_load_kg) { setErr(`Загрузка вне системы — от 0 до ${p.max_load_kg} кг`); return; }
    const body = { departure: v.departure, cutoff: v.cutoff, arrival_from: v.arrival_from || null, arrival_to: v.arrival_to || null, base_load_kg: load };
    setBusy(true);
    try {
      const w = wave ? await put<Wave>(`/api/admin/waves/${encodeURIComponent(wave.id)}`, body)
        : await post<Wave>('/api/admin/waves', { ...body, direction: v.direction });
      toast(wave ? 'Партия сохранена' : 'Партия добавлена');
      onSaved(w);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field"><span className="label">Направление</span>
          <select className="select" disabled={!!wave} value={v.direction} onChange={(e) => set('direction', e.target.value)}>
            {Object.values(meta.directions).map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
          </select></label>
        <label className="field"><span className="label">Загрузка вне системы, кг</span>
          <input className="input" inputMode="decimal" value={v.base_load_kg} onChange={(e) => set('base_load_kg', e.target.value)} /></label>
        <label className="field"><span className="label">Отправка</span>
          <input type="date" className="input" value={v.departure} onChange={(e) => {
            const d = e.target.value;
            setV((s) => ({ ...s, departure: d, cutoff: cutoffTouched ? s.cutoff : shift(d, -p.cutoff_days_before) }));
          }} /></label>
        <label className="field"><span className="label">Приём заказов до (включительно)</span>
          <input type="date" className="input" value={v.cutoff} onChange={(e) => { setCutoffTouched(true); set('cutoff', e.target.value); }} /></label>
        <label className="field"><span className="label">Прибытие с</span>
          <input type="date" className="input" value={v.arrival_from} onChange={(e) => set('arrival_from', e.target.value)} /></label>
        <label className="field"><span className="label">Прибытие по</span>
          <input type="date" className="input" value={v.arrival_to} onChange={(e) => set('arrival_to', e.target.value)} /></label>
      </div>
      <p className="text-[13px] text-muted">
        Даты прибытия можно не заполнять — посчитаем по нормативу: {p.transit_days.join('–')} дней, в межсезонье (май, ноябрь) +{p.off_season_extra_days}.
        {wave && ' Направление партии не меняется: от него зависят заказы в ней.'}
        {(v.arrival_from || v.arrival_to) && <> <button type="button" className="text-accent underline" onClick={() => setV((s) => ({ ...s, arrival_from: '', arrival_to: '' }))}>Рассчитать по нормативу</button></>}
      </p>
      {err && <p role="alert" className="rounded-card border-l-4 border-accent bg-pink px-4 py-3 text-[13px]">{err}</p>}
      <div className="flex flex-wrap gap-3">
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Сохраняем…' : wave ? 'Сохранить' : 'Добавить партию'}</button>
        <button type="button" className="btn" onClick={onCancel}>Отмена</button>
      </div>
    </form>
  );
}
