// Приведение фото к формату, который показывают все браузеры.
// JPG, PNG, WEBP, AVIF, GIF, SVG — как есть; HEIC/HEIF, TIFF, BMP, ICO — конвертируем в JPEG.
const KEEP: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', jfif: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  avif: 'image/avif', gif: 'image/gif', svg: 'image/svg+xml',
};
const HEIC = ['heic', 'heif'];
const TIFF = ['tif', 'tiff'];
const RASTER = ['bmp', 'ico', 'cur'];

export const ACCEPT = 'image/*,.heic,.heif,.tif,.tiff,.bmp,.ico,.svg,.avif';

const ext = (name: string) => name.split('.').pop()?.toLowerCase() || '';

function kind(file: File): string {
  const t = file.type.toLowerCase();
  if (t === 'image/heic' || t === 'image/heif') return 'heic';
  if (t === 'image/tiff') return 'tiff';
  if (t === 'image/bmp' || t === 'image/x-ms-bmp' || t === 'image/x-icon' || t === 'image/vnd.microsoft.icon') return 'raster';
  const e = ext(file.name);
  if (HEIC.includes(e)) return 'heic';
  if (TIFF.includes(e)) return 'tiff';
  if (RASTER.includes(e)) return 'raster';
  if (Object.values(KEEP).includes(t) || KEEP[e]) return 'keep';
  return t.startsWith('image/') ? 'raster' : 'unknown';
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Не удалось конвертировать фото'))), 'image/jpeg', 0.9));
}

function whiteCanvas(w: number, h: number) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  return { canvas, ctx };
}

async function rasterToJpeg(file: Blob): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const { canvas, ctx } = whiteCanvas(img.naturalWidth, img.naturalHeight);
    ctx.drawImage(img, 0, 0);
    return await canvasToJpeg(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function tiffToJpeg(file: Blob): Promise<Blob> {
  const UTIF = await import('utif2');
  const buf = await file.arrayBuffer();
  const ifd = UTIF.decode(buf)[0];
  if (!ifd) throw new Error('Не удалось прочитать TIFF');
  UTIF.decodeImage(buf, ifd);
  const rgba = UTIF.toRGBA8(ifd);
  const { canvas, ctx } = whiteCanvas(ifd.width, ifd.height);
  const tmp = document.createElement('canvas');
  tmp.width = ifd.width; tmp.height = ifd.height;
  tmp.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(rgba.buffer as ArrayBuffer, rgba.byteOffset, rgba.byteLength), ifd.width, ifd.height), 0, 0);
  ctx.drawImage(tmp, 0, 0);
  return canvasToJpeg(canvas);
}

async function heicToJpeg(file: Blob): Promise<Blob> {
  const heic2any = (await import('heic2any')).default;
  const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
  return Array.isArray(out) ? out[0] : out;
}

/** Возвращает файл для загрузки и его MIME-тип. */
export async function prepareImage(file: File): Promise<{ blob: Blob; type: string }> {
  switch (kind(file)) {
    case 'keep': return { blob: file, type: file.type || KEEP[ext(file.name)] };
    case 'heic': return { blob: await heicToJpeg(file), type: 'image/jpeg' };
    case 'tiff': return { blob: await tiffToJpeg(file), type: 'image/jpeg' };
    case 'raster': return { blob: await rasterToJpeg(file), type: 'image/jpeg' };
    default: throw new Error(`«${file.name}» — не изображение`);
  }
}
