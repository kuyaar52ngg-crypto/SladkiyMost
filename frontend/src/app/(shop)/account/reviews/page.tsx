'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AccountHead } from '@/features/account/page';
import { Card } from '@/features/account/parts';
import { useShop } from '@/features/shop/store';
import { get, post } from '@/shared/api/client';
import type { Review, Reviewable } from '@/shared/api/types';
import { cn } from '@/shared/lib/format';
import { Photo, Stars } from '@/shared/ui';

type Data = { mine: Review[]; pending: Reviewable[] };
const PILL: Record<Review['status'], string> = { pending: 'pill-fill', published: '', rejected: 'pill-soft' };

function Form({ item, onDone }: { item: Reviewable; onDone: () => void }) {
  const { toast } = useShop();
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!rating) { setErr('Поставьте оценку'); return; }
    setBusy(true); setErr('');
    try {
      const r = await post<Review>('/api/account/reviews', { product_id: item.product_id, rating, text });
      toast(r.status === 'published' ? 'Спасибо! Отзыв опубликован' : 'Спасибо! Отзыв появится после проверки');
      onDone();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="rounded-card border border-line p-4">
      <div className="flex gap-3">
        <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-soft"><Photo src={item.photo} alt="" sizes="64px" /></div>
        <div className="min-w-0">
          <Link href={`/product/${item.product_id}`} className="font-semibold hover:text-accent">{item.name}</Link>
          <p className="text-xs text-muted">Заказ {item.order_code}</p>
          <div className="mt-1"><Stars value={rating} onChange={(v) => { setRating(v); setErr(''); }} size="text-2xl" /></div>
        </div>
      </div>
      <textarea aria-label={`Отзыв о товаре ${item.name}`} className="input mt-3 min-h-24" maxLength={1500} placeholder="Что понравилось, к чему подошло, как доехало…" value={text} onChange={(e) => setText(e.target.value)} />
      {err && <p role="alert" className="mt-1 text-xs text-accent">{err}</p>}
      <button type="button" className="btn btn-primary btn-sm mt-3" disabled={busy} onClick={send}>{busy ? 'Отправляем…' : 'Отправить отзыв'}</button>
    </div>
  );
}

export default function AccountReviews() {
  const { user } = useShop();
  const [data, setData] = useState<Data | null>(null);
  const load = useCallback(() => { get<Data>('/api/account/reviews').then(setData).catch(() => setData({ mine: [], pending: [] })); }, []);
  useEffect(() => { if (user) load(); }, [user, load]);
  if (!user) return null;
  return (
    <>
      <AccountHead title="Мои отзывы" text="Оценить товар можно после получения заказа. Отзывы помогают другим выбрать сладости — и нам, и поставщикам." />
      {!data ? <p className="text-muted">Загружаем…</p> : (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <Card title={`Ждут вашей оценки${data.pending.length ? ` · ${data.pending.length}` : ''}`}>
            {data.pending.length
              ? <div className="space-y-4">{data.pending.map((i) => <Form key={i.product_id} item={i} onDone={load} />)}</div>
              : <p className="text-[13px] text-muted">Здесь появятся товары из полученных заказов. <Link href="/account/orders" className="text-accent underline underline-offset-2">Мои заказы</Link></p>}
          </Card>
          <Card title="Оставленные отзывы">
            {data.mine.length ? (
              <div className="space-y-4">{data.mine.map((r) => (
                <div key={r.id} className="border-b border-line pb-4 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/product/${r.product_id}#reviews`} className="font-semibold hover:text-accent">{r.product_name || r.product_id}</Link>
                    <span className={cn('pill', PILL[r.status])}>{r.status_title}</span>
                  </div>
                  <Stars value={r.rating} size="text-sm" />
                  {r.text && <p className="mt-1 text-[13px] whitespace-pre-line">{r.text}</p>}
                  {r.reply && <p className="mt-2 rounded-lg bg-soft px-3 py-2 text-[13px]"><b className="block text-xs">{r.status === 'rejected' ? 'Комментарий модератора' : 'Ответ магазина'}</b>{r.reply}</p>}
                </div>
              ))}</div>
            ) : <p className="text-[13px] text-muted">Вы ещё не оставляли отзывов.</p>}
          </Card>
        </div>
      )}
    </>
  );
}
