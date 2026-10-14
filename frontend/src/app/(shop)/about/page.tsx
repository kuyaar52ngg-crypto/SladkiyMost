import type { Metadata } from 'next';
import Image from 'next/image';
import { get } from '@/shared/api/client';
import type { Meta } from '@/shared/api/types';
import { rub } from '@/shared/lib/format';
import { Crumbs, PageHead } from '@/shared/ui';

export const metadata: Metadata = { title: 'О нас' };

export default async function AboutPage() {
  const { policy: p } = await get<Meta>('/api/meta');
  const biz = [['15%', 'Комиссия с продажи товаров производителей — основной доход.'], [rub(p.gift_box_price), 'Подарочное оформление: коробка с лентой и открытка.'], [rub(p.thermo_price), 'Термоупаковка для шоколада — платная услуга.'], ['B2B', 'Корпоративные наборы к праздникам — заказ от организаций.']];
  return (
    <div className="container-x pt-7 pb-20">
      <Crumbs items={[['Главная', '/'], ['О нас']]} />
      <PageHead title="О «Сладком мосте»" text="Маркетплейс, который объединяет производителей кондитерских изделий Якутии и Донбасса, покупателей и систему сборной доставки." />
      <div className="grid items-center gap-8 md:grid-cols-2 md:gap-12">
        <div className="relative aspect-[3/2] overflow-hidden rounded-card"><Image src="/img/yakutia.jpg" alt="Сладости Якутии" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" /></div>
        <div><h2 className="h2">Зачем мы это делаем</h2>
          <p className="mt-4 text-muted">Жители Якутии и Донбасса интересуются фирменными сладостями друг друга. Но единичная посылка на 7 000 км может стоить дороже самого товара, а шоколад боится и мороза, и жары.</p>
          <p className="mt-3 text-muted">Мы собираем заказы в общие партии, учитываем сезон и даём удобный подарочный сценарий — чтобы региональные сладости стали доступнее.</p></div>
      </div>
      <h2 id="business" className="h2 mt-10 scroll-mt-32">Как зарабатывает платформа</h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{biz.map(([b, t]) => <div key={b} className="card"><b className="mb-1.5 block font-head text-[22px] text-accent">{b}</b><p className="text-[13px]">{t}</p></div>)}</div>
      <p className="mt-4 text-[13px] text-muted">Доставка продаётся по себестоимости доли в партии — это конкурентное преимущество, а не источник прибыли.</p>
      <div id="contacts" className="card-soft mt-8 scroll-mt-32"><h3 className="h3 mb-3">Связаться с нами</h3><p className="text-muted">Вопросы о заказах, сотрудничество с производителями и корпоративные наборы — через раздел <a className="text-accent underline underline-offset-2" href="/account/support">«Поддержка»</a> в личном кабинете или в нашем Telegram-боте.</p></div>
      <section id="privacy" className="card mt-6 scroll-mt-32"><h3 className="h3 mb-3">Политика конфиденциальности</h3>
        <div className="space-y-2 text-[13px] text-muted">
          <p>Мы обрабатываем имя, телефон, адрес и электронную почту только для оформления и доставки заказов, связи по ним и уведомлений, которые вы включили.</p>
          <p>Пароли хранятся в виде необратимого хеша. Данные получателя передаются перевозчику только в объёме, нужном для доставки. Мы не продаём и не передаём данные для рекламы.</p>
          <p>Вы можете изменить данные в разделе «Мои данные» или попросить удалить аккаунт через «Поддержку».</p>
        </div></section>
    </div>
  );
}
