// Telegram Mini App: сайт, открытый из бота (кнопка меню «Магазин» или кнопка под уведомлением).
// SDK telegram-web-app.js подгружаем только внутри Telegram, чтобы не замедлять обычный сайт.

export interface TgWebApp {
  initData: string;
  version: string;
  ready(): void;
  expand(): void;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  isVersionAtLeast(v: string): boolean;
  disableVerticalSwipes?(): void;
  requestWriteAccess?(cb?: (granted: boolean) => void): void;
  BackButton: { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void };
}

declare global {
  interface Window { Telegram?: { WebApp?: TgWebApp } }
}

const FLAG = 'sm_tg';
const SDK = 'https://telegram.org/js/telegram-web-app.js?59';

/** Открыт ли сайт внутри Telegram. Telegram передаёт параметры запуска в hash первой страницы. */
export function inTelegram(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (/tgWebApp(Data|Version|Platform)=/.test(window.location.hash)) { sessionStorage.setItem(FLAG, '1'); return true; }
    return sessionStorage.getItem(FLAG) === '1';
  } catch { return false; }
}

let loading: Promise<TgWebApp | null> | null = null;

export function loadTelegram(): Promise<TgWebApp | null> {
  if (!inTelegram()) return Promise.resolve(null);
  if (window.Telegram?.WebApp) return Promise.resolve(window.Telegram.WebApp);
  loading ??= new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = SDK;
    s.async = true;
    s.onload = () => resolve(window.Telegram?.WebApp ?? null);
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
  return loading;
}

/** Разрешение боту писать пользователю (нужно для уведомлений, если чат с ботом ещё не начат). */
export function askWriteAccess() {
  const app = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;
  if (app?.initData && app.isVersionAtLeast('6.9')) app.requestWriteAccess?.();
}

/** Подписанные данные запуска — бэкенд по ним узнаёт пользователя Telegram. */
export function tgInitData(): string {
  return (typeof window !== 'undefined' && window.Telegram?.WebApp?.initData) || '';
}
