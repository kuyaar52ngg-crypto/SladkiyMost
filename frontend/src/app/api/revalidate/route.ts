import { revalidateTag } from 'next/cache';
import { API_TAG } from '@/shared/api/client';

// Сброс серверного кэша витрины. Обрабатывается самим Next (раньше прокси /api/* в бэкенд).
// Данные публичные, повторная загрузка безвредна. Пропускаем только дубли (двойной клик) — каждое
// осмысленное изменение должно сразу сбросить кэш.
let last = 0;

export async function POST() {
  const now = Date.now();
  if (now - last > 200) {
    last = now;
    revalidateTag(API_TAG);
  }
  return Response.json({ ok: true });
}
