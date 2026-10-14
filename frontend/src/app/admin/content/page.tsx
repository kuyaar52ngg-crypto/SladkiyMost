'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { Toggle } from '@/features/account/parts';
import { AdminHead, Panel } from '@/features/admin/ui';
import { useShop } from '@/features/shop/store';
import { get, put } from '@/shared/api/client';
import type { SiteContent } from '@/shared/api/types';

type Block = keyof SiteContent;

function Text({ label, value, onChange, max, area, hint, placeholder }: { label: string; value: string; onChange: (v: string) => void; max: number; area?: boolean; hint?: ReactNode; placeholder?: string }) {
  return (
    <label className="field"><span className="label">{label}</span>
      {area ? <textarea className="input min-h-20" maxLength={max} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        : <input className="input" maxLength={max} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />}
      <span className="hint">{hint ? <>{hint} · </> : null}{value.length}/{max}</span>
    </label>
  );
}

export default function AdminContent() {
  const { toast } = useShop();
  const [c, setC] = useState<SiteContent | null>(null);
  const [saved, setSaved] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { get<SiteContent>('/api/admin/content').then((x) => { setC(x); setSaved(JSON.stringify(x)); }).catch((e) => setErr(e.message)); }, []);
  if (!c) return <><AdminHead title="Контент сайта" />{err ? <p className="text-accent">{err}</p> : <p className="text-muted">Загружаем…</p>}</>;

  const set = <B extends Block>(b: B, f: keyof SiteContent[B], v: SiteContent[B][keyof SiteContent[B]]) => setC({ ...c, [b]: { ...c[b], [f]: v } });
  const dirty = JSON.stringify(c) !== saved;
  const save = async () => {
    setBusy(true); setErr('');
    try { const x = await put<SiteContent>('/api/admin/content', c); setC(x); setSaved(JSON.stringify(x)); toast('Изменения опубликованы на сайте'); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <>
      <AdminHead title="Контент сайта" text="Тексты витрины: объявление над шапкой, первый экран главной, контакты в подвале. Изменения появляются на сайте сразу после сохранения.">
        <button type="button" className="btn btn-primary" disabled={!dirty || busy} onClick={save}>{busy ? 'Сохраняем…' : 'Опубликовать'}</button>
      </AdminHead>
      {err && <p role="alert" className="mb-4 rounded-card border-l-4 border-accent bg-pink px-4 py-3 text-[13px]">{err}</p>}
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Panel title="Объявление над шапкой">
          <Toggle label="Показывать объявление" on={c.banner.enabled} onChange={(v) => set('banner', 'enabled', v)} />
          <div className="mt-2 grid gap-4">
            <Text label="Текст" max={200} value={c.banner.text} onChange={(v) => set('banner', 'text', v)} placeholder="Открыт сбор новой волны Якутия → Донбасс до 20 октября" />
            <Text label="Ссылка (необязательно)" max={300} value={c.banner.link} onChange={(v) => set('banner', 'link', v)} placeholder="/catalog?region=YKT" hint="страница сайта или https://…" />
          </div>
          <div className="mt-4 rounded-lg bg-accent px-3 py-2 text-center text-xs font-semibold text-white" aria-hidden>{c.banner.text || 'Так будет выглядеть объявление'}</div>
        </Panel>
        <Panel title="Главная: первый экран">
          <div className="grid gap-4">
            <Text label="Надзаголовок" max={80} value={c.hero.overline} onChange={(v) => set('hero', 'overline', v)} />
            <Text label="Заголовок *" max={90} value={c.hero.title} onChange={(v) => set('hero', 'title', v)} />
            <Text label="Подзаголовок" area max={300} value={c.hero.subtitle} onChange={(v) => set('hero', 'subtitle', v)} />
            <Text label="Подпись под кнопками" max={160} value={c.hero.note} onChange={(v) => set('hero', 'note', v)} />
          </div>
        </Panel>
        <Panel title="Контакты в подвале">
          <div className="grid gap-4 sm:grid-cols-2">
            <Text label="Телефон" max={40} value={c.contacts.phone} onChange={(v) => set('contacts', 'phone', v)} placeholder="+7 (900) 000-00-00" />
            <Text label="Почта" max={160} value={c.contacts.email} onChange={(v) => set('contacts', 'email', v)} placeholder="hello@sladkiy-most.ru" />
            <Text label="Telegram" max={100} value={c.contacts.telegram} onChange={(v) => set('contacts', 'telegram', v)} placeholder="@sladkiy_most" />
            <Text label="Часы работы" max={100} value={c.contacts.hours} onChange={(v) => set('contacts', 'hours', v)} placeholder="Ежедневно 9:00–21:00 (мск)" />
          </div>
          <p className="mt-3 text-xs text-muted">Пустые поля на сайте не показываются.</p>
        </Panel>
        <Panel title="Подвал">
          <Text label="Подпись под логотипом" max={160} value={c.footer.tagline} onChange={(v) => set('footer', 'tagline', v)} />
        </Panel>
      </div>
    </>
  );
}
