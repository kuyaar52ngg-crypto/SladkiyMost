import Image from 'next/image';
import { cn } from '@/shared/lib/format';

// Фото товара любого формата и пропорций, вписанное в рамку макета.
// Оптимизация Next — только для своих картинок и Supabase Storage; SVG и GIF отдаются как есть
// (SVG — только через <img>, GIF — чтобы сохранить анимацию), чужие ссылки — без оптимизации.
const ext = (src: string) => src.split(/[?#]/)[0].split('.').pop()?.toLowerCase() || '';
const optimizable = (src: string) => /^\/img\//.test(src) || /^https:\/\/[a-z0-9-]+\.supabase\.co\//.test(src);

export function Photo({ src, alt, sizes, priority, className, fit }: {
  src: string; alt: string; sizes: string; priority?: boolean; className?: string; fit?: 'cover' | 'contain';
}) {
  const e = ext(src);
  const contain = fit ? fit === 'contain' : e === 'svg' || e === 'png';
  return (
    <Image src={src} alt={alt} fill sizes={sizes} priority={priority}
      unoptimized={e === 'svg' || e === 'gif' || !optimizable(src)}
      className={cn(contain ? 'object-contain p-2' : 'object-cover', className)} />
  );
}
