'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useShop } from '@/features/shop/store';
import { post } from '@/shared/api/client';
import type { User } from '@/shared/api/types';
import { askWriteAccess, loadTelegram, type TgWebApp } from './miniApp';

/** Внутри Telegram: разворачивает приложение, входит по Telegram, включает системную кнопку «Назад». */
export function TelegramMiniApp() {
  const { setUser } = useShop();
  const [tg, setTg] = useState<TgWebApp | null>(null);
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    loadTelegram().then((app) => {
      if (!app) return;
      app.ready();
      app.expand();
      if (app.isVersionAtLeast('6.1')) { app.setHeaderColor('#ffffff'); app.setBackgroundColor('#ffffff'); }
      if (app.isVersionAtLeast('7.7')) app.disableVerticalSwipes?.();
      setTg(app);
      if (!app.initData) return;
      post<User | null>('/api/auth/telegram', { init_data: app.initData })
        .then((u) => { if (u) { setUser(u); askWriteAccess(); } })
        .catch(() => null);
    });
  }, [setUser]);

  useEffect(() => {
    if (!tg || !tg.isVersionAtLeast('6.1')) return;
    const back = () => router.back();
    if (path === '/') tg.BackButton.hide(); else tg.BackButton.show();
    tg.BackButton.onClick(back);
    return () => tg.BackButton.offClick(back);
  }, [tg, path, router]);

  return null;
}
