'use client';
import { useRef, useState, type DragEvent } from 'react';
import { post } from '@/shared/api/client';
import type { SignedUpload } from '@/shared/api/types';
import { cn } from '@/shared/lib/format';
import { Icon, Photo } from '@/shared/ui';
import { ACCEPT, prepareImage } from './convert';

const MAX = 10;

async function upload(file: File): Promise<string> {
  const { blob, type } = await prepareImage(file);
  const s = await post<SignedUpload>('/api/admin/uploads', { content_type: type, size: blob.size });
  const res = await fetch(s.upload_url, { method: 'PUT', body: blob, headers: { 'Content-Type': type, 'x-upsert': 'false' } });
  if (!res.ok) throw new Error(`Не удалось загрузить «${file.name}»`);
  return s.public_url;
}

/** Фото товара: drag&drop и выбор файлов, ссылка на картинку, порядок (первое — обложка), удаление. */
export function ImageUploader({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [over, setOver] = useState(false);
  const [err, setErr] = useState('');
  const [url, setUrl] = useState('');
  const latest = useRef(value);
  latest.current = value;

  const add = async (files: FileList | File[]) => {
    const list = Array.from(files).slice(0, MAX - latest.current.length);
    if (!list.length) { setErr(`Не больше ${MAX} фото`); return; }
    setErr(''); setBusy((n) => n + list.length);
    const errors: string[] = [];
    await Promise.all(list.map(async (f) => {
      try { const u = await upload(f); onChange((latest.current = [...latest.current, u])); }
      catch (e) { errors.push((e as Error).message); }
      finally { setBusy((n) => n - 1); }
    }));
    if (errors.length) setErr(errors.join('. '));
  };
  const addUrl = () => {
    const u = url.trim();
    if (!/^https?:\/\/\S+$/.test(u)) { setErr('Вставьте ссылку, начинающуюся с https://'); return; }
    if (value.length >= MAX) { setErr(`Не больше ${MAX} фото`); return; }
    onChange([...value, u]); setUrl(''); setErr('');
  };
  const move = (i: number, d: number) => {
    const v = [...value];
    [v[i], v[i + d]] = [v[i + d], v[i]];
    onChange(v);
  };
  const drop = (e: DragEvent) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files.length) add(e.dataTransfer.files); };

  return (
    <div className="field">
      <span className="label">Фото *</span>
      <div onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={drop}
        className={cn('rounded-card border-2 border-dashed p-4 text-center transition', over ? 'border-accent bg-pink' : 'border-line')}>
        <p className="text-sm">Перетащите фото сюда или{' '}
          <button type="button" className="font-semibold text-accent underline underline-offset-2" onClick={() => input.current?.click()}>выберите файлы</button></p>
        <p className="hint mt-1">Любой формат: JPG, PNG, WEBP, AVIF, GIF, SVG, HEIC, TIFF, BMP · до 20 МБ · до {MAX} фото</p>
        <input ref={input} type="file" accept={ACCEPT} multiple hidden onChange={(e) => { if (e.target.files) add(e.target.files); e.target.value = ''; }} />
        {busy > 0 && <p className="mt-2 text-[13px] text-muted">Загружаем… ({busy})</p>}
      </div>
      {value.length > 0 && (
        <ul className="mt-2 grid grid-cols-3 gap-2.5 sm:grid-cols-5">
          {value.map((src, i) => (
            <li key={src} className="group relative aspect-square overflow-hidden rounded-lg border border-line bg-soft">
              <Photo src={src} alt={`Фото ${i + 1}`} sizes="120px" />
              {i === 0 && <span className="absolute top-1 left-1 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium text-accent">Обложка</span>}
              <div className="absolute inset-x-1 bottom-1 flex justify-between gap-1">
                <button type="button" aria-label="Левее" disabled={i === 0} onClick={() => move(i, -1)} className="grid size-7 place-items-center rounded-full bg-white/90 disabled:opacity-30"><Icon name="back" className="size-4" /></button>
                <button type="button" aria-label="Удалить фото" onClick={() => onChange(value.filter((_, n) => n !== i))} className="grid size-7 place-items-center rounded-full bg-white/90 text-accent"><Icon name="x" className="size-4" /></button>
                <button type="button" aria-label="Правее" disabled={i === value.length - 1} onClick={() => move(i, 1)} className="grid size-7 place-items-center rounded-full bg-white/90 disabled:opacity-30"><Icon name="arrow" className="size-4" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex gap-2">
        <input className="input" type="url" placeholder="или вставьте ссылку на картинку" value={url} onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addUrl(); } }} />
        <button type="button" className="btn" onClick={addUrl}>Добавить</button>
      </div>
      {err && <p className="text-xs text-accent">{err}</p>}
    </div>
  );
}
