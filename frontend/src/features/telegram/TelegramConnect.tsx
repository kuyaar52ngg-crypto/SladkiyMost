'use client';
import { useState } from 'react';
import { useShop } from '@/features/shop/store';
import { post } from '@/shared/api/client';
import { cn } from '@/shared/lib/format';

/** Кнопка «Подключить Telegram»: одноразовая ссылка t.me/<бот>?start=<токен>. */
export function TelegramConnect({ className }: { className?: string }) {
  const { user, refreshUser, toast } = useShop();
  const [busy, setBusy] = useState(false);
  if (!user) return null;
  if (user.telegram) {
    return <p className={cn('text-[13px] text-ok', className)}>Telegram подключён — уведомления о заказах приходят туда.</p>;
  }
  const connect = async () => {
    setBusy(true);
    // окно открываем сразу, иначе браузер заблокирует его как всплывающее
    const win = window.open('', '_blank');
    try {
      const { url } = await post<{ url: string }>('/api/auth/telegram-link');
      if (win) win.location.href = url; else window.location.href = url;
      toast('Нажмите «Старт» в боте, затем вернитесь сюда');
      // ждём, пока бот привяжет чат
      for (let i = 0; i < 40 && !(await refreshUser())?.telegram; i++) await new Promise((r) => setTimeout(r, 3000));
    } catch (e) { win?.close(); toast((e as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <button type="button" className={cn('btn w-full', className)} onClick={connect} disabled={busy}>
      {busy ? 'Ждём подтверждения в Telegram…' : 'Подключить Telegram'}
    </button>
  );
}
