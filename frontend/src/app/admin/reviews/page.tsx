'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AdminHead, Kpi, Pager, Panel, paginate } from '@/features/admin/ui';
import { useShop } from '@/features/shop/store';
import { get, post } from '@/shared/api/client';
import type { Review, ReviewStatus } from '@/shared/api/types';
import { cn } from '@/shared/lib/format';
import { Stars } from '@/shared/ui';

const TABS: [ReviewStatus | '', string][] = [['pending', 'На модерации'], ['published', 'Опубликованы'], ['rejected', 'Отклонены'], ['', 'Все']];
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('ru-RU') : '—');

function Item({ r, onSaved }: { r: Review; onSaved: (r: Review) => void }) {
  const { toast } = useShop();
  const [reply, setReply] = useState(r.reply);
  const [busy, setBusy] = useState(false);
  const save = async (status?: ReviewStatus) => {
    setBusy(true);
    try {
      const out = await post<Review>(`/api/admin/reviews/${r.id}`, { status: status ?? null, reply });
      onSaved(out);
      toast(status === 'published' ? 'Отзыв опубликован' : status === 'rejected' ? 'Отзыв отклонён' : 'Ответ сохранён');
    } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <article className="border-b border-line py-5 first:pt-0 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/product/${r.product_id}#reviews`} className="font-semibold hover:text-accent">{r.product_name}</Link>
          <p className="text-xs text-muted">{r.author} · заказ {r.order_code} · {when(r.created_at)}</p>
        </div>
        <div className="flex items-center gap-3"><Stars value={r.rating} /><span className={cn('pill', r.status === 'pending' ? 'pill-fill' : 'pill-soft')}>{r.status_title}</span></div>
      </div>
      <p className={cn('mt-3 text-[14px] whitespace-pre-line', !r.text && 'text-muted')}>{r.text || 'Только оценка, без текста.'}</p>
      <label className="field mt-3"><span className="label">{r.status === 'rejected' ? 'Комментарий покупателю' : 'Ответ на сайте (необязательно)'}</span>
        <textarea className="input min-h-16" maxLength={1500} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Спасибо за отзыв!…" />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        {r.status !== 'published' && <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => save('published')}>Опубликовать</button>}
        {r.status !== 'rejected' && <button type="button" className="btn btn-sm" disabled={busy} onClick={() => save('rejected')}>{r.status === 'published' ? 'Снять с сайта' : 'Отклонить'}</button>}
        {reply !== r.reply && <button type="button" className="btn btn-sm" disabled={busy} onClick={() => save()}>Сохранить ответ</button>}
      </div>
    </article>
  );
}

export default function AdminReviews() {
  const [all, setAll] = useState<Review[] | null>(null);
  const [tab, setTab] = useState<ReviewStatus | ''>('pending');
  const [page, setPage] = useState(1);
  const load = useCallback(() => { get<Review[]>('/api/admin/reviews').then(setAll).catch(() => setAll([])); }, []);
  useEffect(load, [load]);
  const list = all || [];
  const shown = list.filter((r) => !tab || r.status === tab);
  const { rows: items, pages } = paginate(shown, page, 10);
  const pub = list.filter((r) => r.status === 'published');
  const avg = pub.length ? (pub.reduce((s, r) => s + r.rating, 0) / pub.length).toFixed(1) : '—';
  const saved = (r: Review) => setAll((l) => (l || []).map((x) => (x.id === r.id ? r : x)));

  return (
    <>
      <AdminHead title="Отзывы" text="Покупатели оценивают товары из полученных заказов. Решите, что публиковать, и ответьте от имени площадки." />
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi title="Ждут модерации" value={list.filter((r) => r.status === 'pending').length} />
        <Kpi title="Опубликовано" value={pub.length} />
        <Kpi title="Средняя оценка" value={avg} hint="по опубликованным" />
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        {TABS.map(([k, t]) => <button key={t} type="button" className={cn('pill', tab !== k && 'pill-soft')} onClick={() => { setTab(k); setPage(1); }}>{t} · {k ? list.filter((r) => r.status === k).length : list.length}</button>)}
      </div>
      <Panel className="mt-5">
        {!all ? <p className="text-muted">Загружаем…</p> : items.length
          ? <>{items.map((r) => <Item key={`${r.id}-${r.status}-${r.reply}`} r={r} onSaved={saved} />)}<Pager page={page} pages={pages} total={shown.length} shown={items.length} onPage={setPage} /></>
          : <p className="text-muted">{tab === 'pending' ? 'Новых отзывов нет — всё проверено.' : 'Отзывов пока нет.'}</p>}
      </Panel>
      <p className="mt-4 text-xs text-muted">Премодерацию можно выключить в разделе «Настройки» — тогда отзывы будут появляться на сайте сразу.</p>
    </>
  );
}
