// HTTP-клиент. В браузере — относительные /api/* (проксируются Next в FastAPI),
// на сервере (RSC) — напрямую в BACKEND_URL.
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const base = () => (typeof window === 'undefined' ? process.env.BACKEND_URL || 'http://localhost:8000' : '');

export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(base() + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const d = (data as { detail?: unknown }).detail;
    const msg = typeof d === 'string' ? d : Array.isArray(d) ? 'Проверьте заполнение полей' : 'Ошибка сервера';
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

export const get = <T>(path: string) => api<T>('GET', path);
export const post = <T>(path: string, body?: unknown) => api<T>('POST', path, body ?? {});
export const put = <T>(path: string, body: unknown) => api<T>('PUT', path, body);
export const del = <T>(path: string) => api<T>('DELETE', path);
