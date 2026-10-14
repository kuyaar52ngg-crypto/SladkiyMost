'use client';
import { useEffect, useState } from 'react';
import { useShop } from '@/features/shop/store';
import { post } from '@/shared/api/client';
import type { QuoteResponse, Wave } from '@/shared/api/types';
import { fmtDate, kg, rub } from '@/shared/lib/format';
import { FillBar, Note } from '@/shared/ui';

/** Калькулятор доставки: расчёт выполняет бэкенд (POST /api/quote/estimate). */
export function Calculator({ waves }: { waves: Wave[] }) {
  const { meta } = useShop();
  const [waveId, setWaveId] = useState(waves[0]?.id || '');
  const [weight, setWeight] = useState('1');
  const [choc, setChoc] = useState(false);
  const [r, setR] = useState<QuoteResponse | null>(null);
  useEffect(() => {
    const w = Math.min(30, Math.max(0.1, Number(weight.replace(',', '.')) || 0.1));
    if (!waveId) return;
    const t = setTimeout(() => post<QuoteResponse>('/api/quote/estimate', { wave_id: waveId, weight_kg: w, chocolate: choc }).then(setR).catch(() => setR(null)), 150);
    return () => clearTimeout(t);
  }, [waveId, weight, choc]);
  const q = r?.quote;
  return (
    <div className="card-pink">
      <h3 className="h3 mb-4">Калькулятор доставки</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field"><span className="label">Волна</span><select className="select" value={waveId} onChange={(e) => setWaveId(e.target.value)}>{waves.map((w) => <option key={w.id} value={w.id}>{w.title} · {fmtDate(w.departure)}</option>)}</select></label>
        <label className="field"><span className="label">Вес сладостей, кг</span><input className="input" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} /></label>
      </div>
      <label className="check mt-3"><input type="checkbox" checked={choc} onChange={(e) => setChoc(e.target.checked)} />Есть шоколадные изделия</label>
      {q && r && (
        <div className="mt-4">
          <FillBar load={r.wave.load_kg} add={q.weight_kg} max={meta.policy.max_load_kg} />
          <div className="mt-1.5 flex justify-between text-xs text-muted"><span>Партия: {kg(r.wave.load_kg)} + ваши {kg(q.weight_kg)}</span><span>{Math.round(q.fill * 100)}%</span></div>
          <p className="formula">{kg(q.weight_kg)} × {q.rate} ₽/кг = {rub(q.delivery_rub)}</p>
          <p className="text-[13px] text-muted">Отдельной посылкой по базовому тарифу: {rub(q.base_delivery_rub)}{q.saving_rub > 0 && <> · экономия <b className="text-accent">{rub(q.saving_rub)}</b></>}</p>
          {q.next_discount && <p className="mt-2 text-[13px]">Ещё {kg(q.next_discount.need_kg)} в партии — и тариф станет {q.next_discount.rate} ₽/кг.</p>}
          {q.thermo.required && <Note kind="warn" className="mt-3">{q.thermo.reason} +{rub(q.thermo_rub)}</Note>}
          {r.wave.off_season && <Note kind="warn" className="mt-3">Межсезонье: срок доставки увеличен на 7 дней.</Note>}
        </div>
      )}
    </div>
  );
}
