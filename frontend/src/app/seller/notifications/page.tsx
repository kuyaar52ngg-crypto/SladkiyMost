'use client';
import Link from 'next/link';
import { useNotices } from '@/features/account/data';
import { localLink } from '@/features/account/parts';
import { AdminHead, Panel } from '@/features/admin/ui';
import { post } from '@/shared/api/client';
import { cn } from '@/shared/lib/format';

export default function SellerNotifications() {
  const [list, reload] = useNotices();
  const read = async (ids?: number[]) => { await post('/api/account/notifications/read', { ids: ids ?? null }).catch(() => null); reload(); };
  return (
    <>
      <AdminHead title="Уведомления" crumb={[['Кабинет поставщика', '/seller'], ['Уведомления']]}>
        <button type="button" className="btn btn-primary" disabled={!list?.some((n) => !n.read)} onClick={() => read()}>Отметить всё прочитанным</button>
      </AdminHead>
      <Panel>
        {!list ? <p className="text-muted">Загружаем…</p> : list.length ? (
          <ul className="divide-y divide-line">{list.map((n) => (
            <li key={n.id} className={cn('py-4', n.read && 'opacity-70')}>
              <div className="flex flex-wrap items-center gap-2"><b>{n.title}</b>{!n.read && <span className="pill">Новое</span>}</div>
              <p className="mt-1 text-sm">{n.body}</p>
              <p className="mt-1 text-xs text-muted">{new Date(n.created_at).toLocaleString('ru-RU')}</p>
              {n.link && <Link className="mt-2 inline-block text-[13px] text-accent" href={localLink(n.link)} onClick={() => !n.read && read([n.id])}>Открыть</Link>}
            </li>
          ))}</ul>
        ) : <p className="text-sm text-muted">Уведомлений пока нет. Здесь появятся новые заказы магазина.</p>}
      </Panel>
    </>
  );
}
