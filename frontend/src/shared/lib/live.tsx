'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

// «Живое» обновление: API отдаёт номер последнего изменения данных (/api/live). Открытая страница
// опрашивает его и, когда номер сменился, сбрасывает кэш витрины, перерисовывает серверные компоненты
// (router.refresh) и сообщает клиентским (useLive), что пора перезагрузить данные. Перезагружать
// вкладку вручную не нужно. Скрытая вкладка не опрашивает, а при возврате проверяет сразу.
const EVENT = 'sm:live';
const INTERVAL = 8000;

export function LiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    let rev: number | null = null, busy = false, timer: ReturnType<typeof setTimeout> | undefined;
    const check = async () => {
      clearTimeout(timer);
      if (document.visibilityState === 'visible' && !busy) {
        busy = true;
        try {
          const res = await fetch('/api/live', { cache: 'no-store' });
          const next = res.ok ? Number((await res.json()).rev) || 0 : rev;
          if (rev !== null && next !== null && next !== rev) {
            await fetch('/api/revalidate', { method: 'POST' }).catch(() => null);
            router.refresh();
            window.dispatchEvent(new Event(EVENT));
          }
          rev = next;
        } catch { /* сеть недоступна — попробуем позже */ }
        busy = false;
      }
      timer = setTimeout(check, INTERVAL);
    };
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    check();
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [router]);
  return null;
}

/** Перезагружать данные клиентского компонента, когда на сайте что-то изменилось. */
export function useLive(reload: () => unknown) {
  const ref = useRef(reload);
  ref.current = reload;
  useEffect(() => {
    const h = () => { ref.current(); };
    window.addEventListener(EVENT, h);
    return () => window.removeEventListener(EVENT, h);
  }, []);
}
