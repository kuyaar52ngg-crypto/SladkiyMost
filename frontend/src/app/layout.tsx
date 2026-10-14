import type { Metadata, Viewport } from 'next';
import { Inter, Manrope, Montserrat_Alternates } from 'next/font/google';
import { ShopProvider } from '@/features/shop/store';
import { get } from '@/shared/api/client';
import type { Meta } from '@/shared/api/types';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-inter' });
const manrope = Manrope({ subsets: ['latin', 'cyrillic'], variable: '--font-manrope' });
const mont = Montserrat_Alternates({ subsets: ['latin', 'cyrillic'], weight: '800', variable: '--font-mont' });

export const metadata: Metadata = {
  title: { default: 'Сладкий мост — сладости Якутии и Донбасса', template: '%s · Сладкий мост' },
  description: 'Маркетплейс кондитерских изделий между Якутией и Донбассом. Сборные отправки снижают стоимость доставки.',
  icons: { icon: '/img/logo.svg' },
};
export const viewport: Viewport = { themeColor: '#43281f', viewportFit: 'cover' };
export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let meta: Meta | null = null;
  try { meta = await get<Meta>('/api/meta'); } catch { /* бэкенд недоступен */ }
  return (
    <html lang="ru" className={`${inter.variable} ${manrope.variable} ${mont.variable}`}>
      <body>
        {meta ? <ShopProvider meta={meta}>{children}</ShopProvider> : (
          <main className="container-x py-24 text-center">
            <h1 className="h2">Сервис временно недоступен</h1>
            <p className="mt-3 text-muted">Не удалось подключиться к API. Проверьте, что бэкенд запущен (BACKEND_URL).</p>
          </main>
        )}
      </body>
    </html>
  );
}
