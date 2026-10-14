'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Layout, Loading, Summary } from '@/features/checkout/common';
import { cartFor, goods, netKg, other, useShop } from '@/features/shop/store';
import type { RegionId } from '@/shared/api/types';
import { kg, rub } from '@/shared/lib/format';
import { Crumbs, Icon, Note, PageHead, Photo, Steps } from '@/shared/ui';

export default function CartPage() {
  const { ready, cart, setQty, toast, draft, setDraft, meta } = useShop();
  const router = useRouter();
  if (!ready) return <Loading />;
  const groups = (['YKT', 'DNR'] as RegionId[]).map((r) => ({ origin: r, items: cartFor(cart, r) })).filter((g) => g.items.length);
  if (!groups.length) {
    return (
      <div className="container-x pt-7 pb-20"><Crumbs items={[['Главная', '/'], ['Корзина']]} />
        <PageHead title="Корзина" text="0 товаров · здесь появятся выбранные вами сладости." />
        <div className="mx-auto max-w-[560px] py-10 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-pink text-accent"><Icon name="bag" className="size-6" /></span>
          <h2 className="h3 mt-6">В корзине пока нет сладостей</h2>
          <p className="mt-3 text-[15px] text-muted">Загляните в каталог: там вкусы Якутии и Донбасса для тёплого чаепития. Выберите то, что хочется попробовать.</p>
          <Link className="btn btn-primary mt-6" href="/catalog">Перейти в каталог</Link>
          <p className="mt-6 text-xs text-muted">Начните с любимого вкуса. Оформление станет доступно после добавления товаров.</p>
        </div></div>
    );
  }
  const go = (origin: RegionId) => {
    if (draft.origin !== origin) setDraft({ origin, wave_id: null, gift: !!draft.gift && draft.origin === origin });
    router.push('/checkout/wave');
  };
  return (
    <div className="container-x pt-7 pb-20">
      <Crumbs items={[['Главная', '/'], ['Корзина']]} />
      <PageHead title="Корзина" text="Сладости едут сборными отправками из региона производителя в регион получателя." />
      <Steps current={1} />
      <Layout
        main={<div className="space-y-6">{groups.map((g) => {
          const to = meta.regions[other(g.origin)];
          return (
            <section key={g.origin} className="card">
              <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="h3">{meta.directions[g.origin === 'YKT' ? 'YKT-DNR' : 'DNR-YKT'].title}</h3><span className="tag">{meta.regions[g.origin].showcase}</span></div>
              <p className="mt-2 text-[13px] text-muted">Получатель — в регионе «{to.name}» ({to.city} и область).</p>
              <div className="mt-3">{g.items.map((i) => (
                <div key={i.id} className="grid grid-cols-[64px_1fr] items-center gap-x-4 gap-y-2 border-b border-line py-3.5 last:border-0 sm:grid-cols-[72px_1fr_auto_auto]">
                  <div className="relative h-16 overflow-hidden rounded-lg bg-soft"><Photo src={i.photo} alt="" sizes="72px" /></div>
                  <div><Link className="font-semibold" href={`/product/${i.id}`}>{i.name}</Link>
                    <p className="text-[13px] text-muted">{i.weight_g} г · {rub(i.price_rub)}{i.temp_sensitive && <span className="text-snow"> · шоколад</span>}</p>
                    <button className="link mt-1.5" onClick={() => { setQty(i.id, 0); toast('Товар удалён'); }}>Удалить</button></div>
                  <div className="inline-flex w-fit items-center rounded-lg border border-line max-sm:col-start-2">
                    <button className="h-8.5 w-8 text-accent" aria-label="Меньше" onClick={() => setQty(i.id, i.qty - 1)}>−</button><span className="min-w-6 text-center">{i.qty}</span>
                    <button className="h-8.5 w-8 text-accent" aria-label="Больше" onClick={() => setQty(i.id, i.qty + 1)}>+</button>
                  </div>
                  <b className="whitespace-nowrap max-sm:col-start-2">{rub(i.price_rub * i.qty)}</b>
                </div>
              ))}</div>
              {g.items.some((i) => i.temp_sensitive) && <Note kind="warn" className="mt-3">В отправке есть шоколадные изделия — на шаге расчёта подскажем, нужна ли термоупаковка по сезону.</Note>}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-[13px] text-muted">Товары: <b className="text-ink">{rub(goods(g.items))}</b> · вес нетто {kg(netKg(g.items))}</p>
                <button className="btn btn-primary max-sm:w-full" onClick={() => go(g.origin)}>Выбрать отправку <Icon name="arrow" className="size-4" /></button>
              </div>
            </section>
          );
        })}</div>}
        aside={<>
          <div className="card-soft"><h3 className="h3 mb-4">Ваш заказ</h3><Summary items={cart} /><hr className="divider" />
            <p className="text-[13px] text-muted">Стоимость доставки рассчитаем на следующем шаге — она зависит от веса и заполнения выбранной волны.</p></div>
          {groups.length > 1 && <Note>В корзине сладости двух регионов — это две отправки в разные стороны. Оформите их по очереди.</Note>}
          {draft.gift && <Note>Оформляем как подарок. Открытку заполните на шаге «Оформление».</Note>}
        </>}
      />
    </div>
  );
}
