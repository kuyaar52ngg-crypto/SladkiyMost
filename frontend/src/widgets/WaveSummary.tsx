import type { Wave } from '@/shared/api/types';
import { fmtDate, fmtRange, kg, plural } from '@/shared/lib/format';
import { FillBar } from '@/shared/ui';

export function WaveSummary({ w, max }: { w: Wave; max: number }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between gap-3">
        <span className="tag">{w.title}</span>
        <span className="text-[13px] text-muted">осталось {w.days_left} {plural(w.days_left, 'день', 'дня', 'дней')}</span>
      </div>
      <h3 className="mt-3 mb-1.5 font-head text-lg font-semibold">Сбор до {fmtDate(w.cutoff)} · отправка {fmtDate(w.departure)}</h3>
      <p className="text-[13px] text-muted">Получение, ориентир: {fmtRange(w.arrival_from, w.arrival_to)}{w.off_season && ' (межсезонье +7 дней)'}</p>
      <FillBar load={w.load_kg} max={max} />
      <div className="mt-1.5 flex flex-wrap justify-between gap-2 text-xs text-muted">
        <span>Заполнено {kg(w.load_kg)} из {max}</span>
        <span>Сейчас <b className="text-accent">{w.rate} ₽/кг</b>{w.discount_percent > 0 && ` (−${w.discount_percent}%)`}</span>
      </div>
    </div>
  );
}
