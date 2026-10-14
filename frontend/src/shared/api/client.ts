// HTTP-клиент. В браузере — относительные /api/* (проксируются Next в FastAPI),
// на сервере (RSC) — напрямую в BACKEND_URL.
// Серверные GET-запросы идут без cookie, то есть читают только публичные данные — их держим в Data Cache
// Next (тег API_TAG) и обновляем раз в минуту или сразу после изменений (POST /api/revalidate).
export const API_TAG = 'api';
const SERVER_REVALIDATE = 60;
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

// Сессия Telegram Mini App: если cookie недоступна (Telegram Web открывает приложение во фрейме),
// токен сессии передаётся заголовком.
const TOKEN_KEY = 'sm_token';
export function setSessionToken(token: string | null) {
  try { if (token) sessionStorage.setItem(TOKEN_KEY, token); else sessionStorage.removeItem(TOKEN_KEY); } catch { /* приватный режим */ }
}
function authHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try { const t = sessionStorage.getItem(TOKEN_KEY); return t ? { Authorization: `Bearer ${t}` } : {}; } catch { return {}; }
}

// Изменения, после которых витрина должна показать свежие данные (товары, партии, категории, тексты, отзывы).
const CHANGES_STOREFRONT = /^\/api\/(admin\/(products|orders|waves|categories|content|settings|reviews|shops)|seller\/products|orders|account\/reviews)/;

/** Сбросить кэш витрины на сервере Next после изменений. */
export function refreshStorefront() {
  if (typeof window !== 'undefined') fetch('/api/revalidate', { method: 'POST' }).catch(() => {});
}

const base = () => (typeof window === 'undefined' ? process.env.BACKEND_URL || 'http://localhost:8000' : '');

export async function api<T>(method: string, path: string, body?: unknown, cacheable = method === 'GET'): Promise<T> {
  const cached = typeof window === 'undefined' && cacheable;
  const res = await fetch(base() + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    credentials: 'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body),
    ...(cached ? { cache: 'force-cache' as const, next: { revalidate: SERVER_REVALIDATE, tags: [API_TAG] } } : { cache: 'no-store' as const }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const d = (data as { detail?: unknown }).detail;
    const msg = typeof d === 'string' ? d : Array.isArray(d) ? 'Проверьте заполнение полей' : 'Ошибка сервера';
    throw new ApiError(res.status, msg);
  }
  if (method !== 'GET' && CHANGES_STOREFRONT.test(path)) refreshStorefront();
  if (path.startsWith('/api/auth/')) {
    const token = (data as { token?: unknown } | null)?.token;
    if (path === '/api/auth/logout') setSessionToken(null);
    else if (typeof token === 'string') setSessionToken(token);
  }
  return data as T;
}

export const get = <T>(path: string) => api<T>('GET', path);
export const post = <T>(path: string, body?: unknown) => api<T>('POST', path, body ?? {});
/** POST без побочных эффектов (расчёты): на сервере кэшируется как GET. */
export const calc = <T>(path: string, body: unknown) => api<T>('POST', path, body, true);
export const put = <T>(path: string, body: unknown) => api<T>('PUT', path, body);
export const del = <T>(path: string) => api<T>('DELETE', path);
