import Image from 'next/image';
import Link from 'next/link';
import { calc, get } from '@/shared/api/client';
import type { Meta, Product, QuoteResponse, Wave } from '@/shared/api/types';
import { fmtDate, kg, rub } from '@/shared/lib/format';
import { Empty, Icon } from '@/shared/ui';
import { ProductCard } from '@/widgets/ProductCard';
import { WaveSummary } from '@/widgets/WaveSummary';

export default async function Home() {
  const [meta, products, waves] = await Promise.all([
    get<Meta>('/api/meta'), get<Product[]>('/api/products?sort=new&limit=8'), get<Wave[]>('/api/waves?only_open=true'),
  ]);
  const p = meta.policy;
  const hero = meta.content.hero;
  const next = (['YKT-DNR', 'DNR-YKT'] as const).map((d) => waves.find((w) => w.direction === d)).filter((w): w is Wave => !!w);
  const sample = [...next].sort((a, b) => a.rate - b.rate)[0];
  const est = sample ? await calc<QuoteResponse>('/api/quote/estimate', { wave_id: sample.id, weight_kg: 1 }) : null;

  return (
    <>
      <section className="container-x grid items-center gap-7 py-7 md:grid-cols-[1fr_1.05fr] md:gap-12 md:py-12">
        <div>
          {hero.overline && <p className="overline">{hero.overline}</p>}
          <h1 className="mt-3.5 mb-5 font-head text-[34px] leading-[1.1] font-bold tracking-tight lg:text-[52px]">{hero.title}</h1>
          {hero.subtitle && <p className="max-w-[470px] text-base text-muted">{hero.subtitle}</p>}
          <div className="mt-6 flex flex-wrap gap-3">
            <Link className="btn btn-primary" href="/catalog">Выбрать сладости <Icon name="bag" className="size-[18px]" /></Link>
            <Link className="btn" href="/delivery">Как работает доставка</Link>
          </div>
          {hero.note && <p className="mt-4 text-[13px] text-muted">{hero.note}</p>}
        </div>
        <div className="relative aspect-[596/520] overflow-hidden rounded-card">
          <Image src="/img/hero.jpg" alt="Зефир, трюфели и печенье к чаю" fill priority sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
          <div className="absolute bottom-3 left-3 max-w-[220px] rounded-card bg-white px-4 py-3 shadow-soft md:bottom-5 md:left-5 md:max-w-[280px] md:px-5 md:py-4">
            <p className="text-xs text-muted uppercase">Два региона — один сладкий мост</p>
            <p className="mt-2 font-semibold">Знакомые вкусы. Новые встречи.</p>
          </div>
        </div>
      </section>

      <section className="border-y border-line">
        <div className="container-x grid gap-3.5 py-6 md:grid-cols-3 md:gap-6">
          {([['pin', 'Сладости двух регионов', 'Якутия и Донбасс в одном каталоге'], ['box', 'Сборная отправка', 'Общие расходы — между заказами'], ['gift', 'Подарки со смыслом', 'Открытка и тёплые слова получателю']] as const).map(([ic, t, s]) => (
            <div key={t} className="flex items-center gap-3.5">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent/5 text-accent"><Icon name={ic} /></span>
              <div><b className="block text-sm font-semibold">{t}</b><span className="text-[13px] text-muted">{s}</span></div>
            </div>
          ))}
        </div>
      </section>

      <section className="container-x py-10 md:py-14">
        <h2 className="h2 mb-6">Два края. Столько любимых вкусов.</h2>
        <div className="grid gap-6 md:grid-cols-2">
          {([['YKT', 'Сладости Якутии', 'Ягодная нежность и характер Севера', 'Зефир, мармелад и конфеты с орехами', ['/img/yakutia.jpg']],
             ['DNR', 'Сладости Донбасса', 'Тёплые традиции к вашему столу', 'Шоколад, печенье и хрустящие вафли', ['/img/truffles.jpg', '/img/cookies.jpg', '/img/wafers.jpg']]] as const).map(([r, t, s, s2, imgs]) => (
            <Link key={r} href={`/catalog?region=${r}`} className="group">
              <div className="relative grid aspect-[588/272] overflow-hidden rounded-card bg-soft" style={{ gridTemplateColumns: `repeat(${imgs.length}, 1fr)` }}>
                {imgs.map((src) => <div key={src} className="relative"><Image src={src} alt="" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover transition duration-500 group-hover:scale-[1.03]" /></div>)}
              </div>
              <div className="mt-4 flex items-center justify-between gap-4">
                <div><h3 className="h3">{t}</h3><p className="text-[13px] text-muted">{s}</p></div>
                <span className="btn btn-sm">Смотреть <Icon name="arrow" className="size-4" /></span>
              </div>
              <p className="mt-2 text-[13px] text-muted">{s2}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="container-x pb-10 md:pb-14">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h2 className="h2">Начните с чего-нибудь любимого</h2>
          <Link className="btn btn-sm max-sm:w-full" href="/catalog">Весь каталог <Icon name="arrow" className="size-4" /></Link>
        </div>
        {products.length
          ? <div className="grid grid-cols-2 gap-x-3 gap-y-5 md:grid-cols-4 md:gap-x-4.5 md:gap-y-6">{products.map((x) => <ProductCard key={x.id} p={x} />)}</div>
          : <Empty title="Скоро здесь появятся сладости" text="Мы уже собираем ассортимент Якутии и Донбасса. Загляните чуть позже." />}
      </section>

      <section className="bg-soft py-10 md:py-14">
        <div className="container-x">
          <div className="grid gap-8 md:grid-cols-[1fr_1.4fr] md:gap-12">
            <div>
              <p className="overline">Ближе друг к другу</p>
              <h2 className="h2 mt-3">Заказывать вместе — выгоднее</h2>
              <p className="mt-4 text-muted">Объединяем заказы в одном направлении в «волны». Общие расходы на перевозку распределяются между участниками: чем больше заполнена партия, тем ниже тариф за килограмм.</p>
              <Link className="btn mt-6" href="/delivery">Как работает доставка <Icon name="arrow" className="size-4" /></Link>
            </div>
            <ol>
              {[['01', 'Выберите сладости', 'Добавьте любимые вкусы в корзину — каталог Якутии или Донбасса.'],
                ['02', 'Присоединитесь к волне', `Отправки — раз в ${p.wave_interval_days} дней в каждом направлении, приём закрывается за ${p.cutoff_days_before} дня.`],
                ['03', 'Получите дешевле', 'Партия заполнена более чем на 50% — тариф −20%, более 80% — −35%. Цена может только снизиться.']].map(([n, t, s]) => (
                <li key={n} className="flex gap-4.5 py-3.5"><span className="min-w-7 font-head text-lg font-semibold text-accent">{n}</span><div><b className="block font-head text-[17px] font-semibold">{t}</b><span className="text-[13px] text-muted">{s}</span></div></li>
              ))}
            </ol>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2">{next.map((w) => <WaveSummary key={w.id} w={w} max={p.max_load_kg} />)}</div>
          {est && (
            <div className="card mt-4 grid items-center gap-6 md:grid-cols-[1.2fr_1fr_auto]">
              <div><span className="tag">Пример расчёта</span><h3 className="h3 mt-3 mb-1">{sample.title}</h3><p className="text-[13px] text-muted">Сбор до {fmtDate(sample.cutoff)} · отправка {fmtDate(sample.departure)}</p></div>
              <div><p className="text-[13px] text-muted">Для посылки 1 кг нетто ({kg(est.quote.weight_kg)} с упаковкой)</p>
                <p className="mt-2 text-xl font-semibold">{rub(est.quote.delivery_rub)} <span className="text-[13px] font-normal text-muted">вместо {rub(est.quote.base_delivery_rub)} при базовом тарифе</span></p></div>
              <Link className="btn btn-primary" href="/catalog">Выбрать сладости</Link>
            </div>
          )}
        </div>
      </section>

      <section className="container-x py-10 md:py-14">
        <div className="grid items-center gap-8 md:grid-cols-2 md:gap-12">
          <div className="relative aspect-[3/2] overflow-hidden rounded-card"><Image src="/img/hero.jpg" alt="Чаепитие со сладостями" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover object-[30%_50%]" /></div>
          <div><p className="overline">О Сладком мосте</p><h2 className="h2 mt-3">У каждого вкуса есть место, которое мы любим</h2>
            <p className="mt-4 text-muted">«Сладкий мост» соединяет Якутию и Донбасс через простые радости: любимую сладость, несложное чаепитие и подарок человеку, который далеко.</p>
            <p className="mt-3 text-[13px]">Два региона в одной посылке — и чуть больше близости в каждом дне.</p></div>
        </div>
        <div className="mt-8 grid overflow-hidden rounded-card bg-pink md:grid-cols-2">
          <div className="flex flex-col items-start justify-center gap-4 px-5 py-7 md:p-12">
            <p className="overline">Тепло в каждой детали</p><h2 className="h2">Подарок, который преодолевает расстояния</h2>
            <p className="text-muted">Выберите сладости, добавьте открытку со своими словами и укажите получателя в другом регионе.</p>
            <Link className="btn btn-primary" href="/gift">Собрать подарок <Icon name="gift" className="size-[18px]" /></Link>
          </div>
          <div className="relative min-h-[280px]"><Image src="/img/gift.jpg" alt="Подарочная коробка со сладостями" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" /></div>
        </div>
      </section>

      <section className="container-x pb-10 md:pb-14">
        <div className="grid gap-8 md:grid-cols-[1fr_1.4fr] md:gap-12">
          <div><h2 className="h2">Всё, что хочется уточнить</h2><p className="mt-3 text-muted">Поможем разобраться в сборной доставке и выборе сладостей.</p></div>
          <div>
            {[[`Как делится стоимость доставки?`, `Тариф за килограмм зависит от заполнения партии: ${p.base_tariff} ₽/кг, при заполнении более 50% — −20%, более 80% — −35%. Ваша доля = вес заказа × тариф. При закрытии сбора пересчитываем по фактической загрузке и возвращаем разницу, если стало дешевле.`],
              ['Можно заказать из двух регионов?', 'Да, корзина общая. Но в одну отправку входят сладости одного региона: они едут волной в регион получателя. Оформите две отправки — по одной на каждое направление.'],
              ['Что с шоколадом зимой и летом?', `В декабре–феврале и июне–августе для шоколадных изделий обязательна термоупаковка (${p.thermo_price} ₽ за заказ). В мае и ноябре — межсезонье на Лене, срок доставки +7 дней.`],
              ['Когда получатель узнает о подарке?', 'Можно отметить «сюрприз» — тогда мы свяжемся с вами перед вручением, а получателю напишем только о прибытии на пункт выдачи.']].map(([q, a], i) => (
              <details key={q} open={i === 0} className="group border-b border-line py-4">
                <summary className="flex cursor-pointer list-none justify-between gap-4 font-semibold">{q}<span className="text-xl leading-none text-accent group-open:hidden">+</span><span className="hidden text-xl leading-none text-accent group-open:inline">–</span></summary>
                <p className="mt-2.5 text-sm text-muted">{a}</p>
              </details>
            ))}
          </div>
        </div>
        <div className="mt-8 rounded-card border border-line px-6 py-12 text-center">
          <h2 className="h2 mb-2.5">Пусть любимый вкус будет рядом</h2>
          <p className="text-muted">Начните с маленькой сладости — для себя или для тех, кого любите.</p>
          <Link className="btn btn-primary mt-6" href="/catalog">Выбрать сладости <Icon name="bag" className="size-[18px]" /></Link>
        </div>
      </section>
    </>
  );
}
