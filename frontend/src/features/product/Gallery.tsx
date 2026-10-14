'use client';
import { useState } from 'react';
import { cn } from '@/shared/lib/format';
import { Photo } from '@/shared/ui';

/** Галерея товара: большое фото и миниатюры (первое фото — обложка). */
export function Gallery({ photos, alt }: { photos: string[]; alt: string }) {
  const [i, setI] = useState(0);
  const cur = photos[Math.min(i, photos.length - 1)];
  return (
    <div className="min-w-0">
      <div className="relative aspect-[570/520] overflow-hidden rounded-card bg-soft">
        <Photo src={cur} alt={alt} priority sizes="(max-width: 768px) 100vw, 50vw" />
      </div>
      {photos.length > 1 && (
        <div className="mt-3 flex gap-2.5 overflow-x-auto pb-1" role="tablist" aria-label="Фото товара">
          {photos.map((src, n) => (
            <button key={src} role="tab" aria-selected={n === i} aria-label={`Фото ${n + 1}`} onClick={() => setI(n)}
              className={cn('relative size-[72px] shrink-0 overflow-hidden rounded-lg border-2 bg-soft', n === i ? 'border-accent' : 'border-transparent')}>
              <Photo src={src} alt="" sizes="72px" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
