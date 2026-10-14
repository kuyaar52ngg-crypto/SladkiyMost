'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useNotices } from '@/features/account/data';
import { AccountHead } from '@/features/account/page';
import { Card, localLink, Toggle } from '@/features/account/parts';
import { useShop } from '@/features/shop/store';
import { TelegramConnect } from '@/features/telegram/TelegramConnect';
import { post, put } from '@/shared/api/client';
import type { Notice, NotificationKind, User } from '@/shared/api/types';
import { cn } from '@/shared/lib/format';

type Filter = 'all' | 'unread' | NotificationKind;
const PREFS = [
  ['notify_orders', 'Изменения статуса заказа'], ['notify_waves', 'Сборные партии и доставка'],
  ['notify_support', 'Ответы поддержки'], ['notify_news', 'Новости и новые вкусы'],
] as const;
type PrefKey = (typeof PREFS)[number][0];

const when = (iso: string) => new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', ' ·');

export default function AccountNotifications() {
  const { user, setUser, toast } = useShop();
  const [list, reload] = useNotices();
  const [f, setF] = useState<Filter>('all');
  const [prefs, setPrefs] = useState(() => Object.fromEntries(PREFS.map(([k]) => [k, user?.[k] ?? true])) as Record<PrefKey, boolean>);
  if (!user) return null;
  const all = list || [];
  const shown = all.filter((n) => f === 'all' || (f === 'unread' ? !n.read : n.kind === f));
  const count = (k: Filter) => all.filter((n) => (k === 'unread' ? !n.read : n.kind === k)).length;
  const chips: [Filter, string][] = [['all', `Все · ${all.length}`], ['unread', `Непрочитанные · ${count('unread')}`], ['order', 'Заказы'], ['wave', 'Доставка'], ['support', 'Поддержка']];

  const read = async (ids?: number[]) => { await post('/api/account/notifications/read', { ids: ids ?? null }).catch(() => null); reload(); };
  const savePrefs = async () => {
    try { setUser(await put<User>('/api/account/profile', prefs)); toast('Настройки уведомлений сохранены'); }
    catch (e) { toast((e as Error).message); }
  };

  return (
    <>
      <AccountHead title="Уведомления" />
      <div className="flex flex-wrap gap-2">
        {chips.map(([k, t]) => <button key={k} type="button" className={cn('pill', f !== k && 'pill-soft')} onClick={() => setF(k)}>{t}</button>)}
      </div>
      <button type="button" className="btn btn-primary mt-6" disabled={!count('unread')} onClick={() => read()}>Отметить всё прочитанным</button>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        <Card title="Последние уведомления">
          {!list ? <p className="text-muted">Загружаем…</p> : shown.length ? (
            <div className="space-y-4">{shown.map((n: Notice) => (
              <article key={n.id} className={cn('rounded-card border border-line p-6', n.read && 'bg-[#faf8f7]')}>
                <h3 className="font-head text-xl font-bold">{n.title}</h3>
                {!n.read && <span className="pill mt-3">Не прочитано</span>}
                <p className="mt-3 text-[13px] text-muted">{when(n.created_at)}</p>
                <p className="mt-3 text-[15px]">{n.body}</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  {n.link && <Link className="btn btn-primary" href={localLink(n.link)} onClick={() => !n.read && read([n.id])}>Подробнее</Link>}
                  {!n.read && <button type="button" className="btn" onClick={() => read([n.id])}>Отметить прочитанным</button>}
                </div>
              </article>
            ))}</div>
          ) : <p className="text-[15px] text-muted">{all.length ? 'В этом разделе уведомлений нет.' : 'Уведомлений пока нет. Здесь появятся статусы заказов, новости о сборных партиях и ответы поддержки.'}</p>}
        </Card>

        <Card title="Настройки уведомлений">
          <div className="divide-y divide-line">
            {PREFS.map(([k, t]) => <Toggle key={k} label={t} on={prefs[k]} onChange={(x) => setPrefs({ ...prefs, [k]: x })} />)}
          </div>
          <p className="mt-4 text-[15px] text-muted">
            {user.telegram ? 'Включённые уведомления приходят в Telegram. В ленте кабинета сохраняются все.' : 'Подключите Telegram, чтобы получать включённые уведомления в мессенджер. В ленте кабинета сохраняются все.'}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" className="btn btn-primary" onClick={savePrefs}>Сохранить настройки</button>
            {!user.telegram && <TelegramConnect className="sm:w-auto" />}
          </div>
        </Card>
      </div>
    </>
  );
}
