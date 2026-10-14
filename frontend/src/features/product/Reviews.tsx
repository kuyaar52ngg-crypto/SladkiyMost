import Link from 'next/link';
import type { ProductReviews } from '@/shared/api/types';
import { Stars } from '@/shared/ui';

const plural = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? 'отзыв' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'отзыва' : 'отзывов');
export const reviewsLabel = (n: number) => `${n} ${plural(n)}`;
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

export function Reviews({ data }: { data: ProductReviews }) {
  return (
    <section id="reviews" className="scroll-mt-32">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="h2">Отзывы</h2>
          {data.count > 0 && <p className="mt-2 flex items-center gap-3 text-[15px]"><b className="text-[22px]">{data.rating.toFixed(1)}</b><Stars value={data.rating} /><span className="text-muted">{reviewsLabel(data.count)}</span></p>}
        </div>
        <Link href="/account/reviews" className="btn btn-sm">Оставить отзыв</Link>
      </div>
      {data.count ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {data.items.map((r) => (
            <article key={r.id} className="card">
              <div className="flex items-center justify-between gap-3"><b>{r.author}</b><Stars value={r.rating} size="text-sm" /></div>
              <p className="mt-1 text-xs text-muted">{day(r.created_at)}</p>
              {r.text && <p className="mt-3 text-[14px] whitespace-pre-line">{r.text}</p>}
              {r.reply && <div className="mt-3 rounded-lg bg-soft px-3 py-2 text-[13px]"><b className="block text-xs">Ответ «Сладкого моста»</b>{r.reply}</div>}
            </article>
          ))}
        </div>
      ) : <p className="mt-4 text-[15px] text-muted">Отзывов пока нет. Купили этот товар? Расскажите, как он вам — оценку можно поставить после получения заказа.</p>}
    </section>
  );
}
