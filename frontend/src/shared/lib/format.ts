const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

const parse = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return { y, m, d }; };

export function fmtDate(iso: string, withYear = false): string {
  const { y, m, d } = parse(iso);
  return `${d} ${MONTHS[m - 1]}${withYear ? ' ' + y : ''}`;
}

export function fmtRange(a: string, b: string): string {
  const pa = parse(a), pb = parse(b);
  return pa.m === pb.m ? `${pa.d}–${pb.d} ${MONTHS[pb.m - 1]}` : `${fmtDate(a)} – ${fmtDate(b)}`;
}

export const rub = (n: number) => `${Math.round(n).toLocaleString('ru-RU')} ₽`;
export const kg = (n: number) => `${(Math.round(n * 10) / 10).toLocaleString('ru-RU')} кг`;

export function plural(n: number, one: string, few: string, many: string): string {
  const m = n % 10, mm = n % 100;
  if (m === 1 && mm !== 11) return one;
  if (m >= 2 && m <= 4 && (mm < 10 || mm >= 20)) return few;
  return many;
}

export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
