import { revalidateTag } from 'next/cache';
import { API_TAG } from '@/shared/api/client';

// Сброс серверного кэша витрины. Обрабатывается самим Next (раньше прокси /api/* в бэкенд).
// Данные публичные, повторная загрузка безвредна — ограничиваем только частоту.
let last = 0;

export async function POST() {
  const now = Date.now();
  if (now - last > 2000) {
    last = now;
    revalidateTag(API_TAG);
  }
  return Response.json({ ok: true });
}
