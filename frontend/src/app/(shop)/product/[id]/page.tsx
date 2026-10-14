import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ProductActions } from '@/features/product/ProductActions';
import { ApiError, get } from '@/shared/api/client';
import type { Meta, Product, Wave } from '@/shared/api/types';
import { fmtDate, fmtRange, rub } from '@/shared/lib/format';
import { Crumbs, Icon, Kv, Note } from '@/shared/ui';
import { ProductCard } from '@/widgets/ProductCard';

type Props = { params: Promise<{ id: string }> };

async function load(id: string) {
  try { return await get<Product>(`/api/products/${encodeURIComponent(id)}`); }
  catch (e) { if (e instanceof ApiError && e.status === 404) notFound(); throw e; }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await load((await params).id);
  return { title: p.name, description: p.description };
}

const SEVERE = [12, 1, 2, 6, 7, 8];

export default async function ProductPage({ params }: Props) {
  const p = await load((await params).id);
  if (!p.active) notFound();
  const dir = p.region === 'YKT' ? 'YKT-DNR' : 'DNR-YKT';
  const [meta, waves, related] = await Promise.all([
    get<Meta>('/api/meta'), get<Wave[]>(`/api/waves?direction=${dir}&only_open=true`), get<Product[]>(`/api/products?region=${p.region}`),
  ]);
  const w = waves[0];
  const region = meta.regions[p.region];
  const severe = w && SEVERE.includes(Number(w.departure.slice(5, 7)));
  return (
    <div className="container-x pt-7 pb-20">
      <Crumbs items={[['Главная', '/'], ['Каталог', '/catalog'], [region.showcase, `/catalog?region=${p.region}`], [p.name]]} />
      <div className="grid gap-8 md:grid-cols-2 md:gap-12">
        <div className="relative aspect-[570/520] overflow-hidden rounded-card"><Image src={p.photo} alt={p.name} fill priority sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" /></div>
        <div>
          <div className="flex flex-wrap gap-2"><span className="chip chip-on">{region.showcase}</span>{p.tag && <span className="chip">{p.tag}</span>}<span className="chip">{p.category}</span></div>
          <h1 className="h1 my-4">{p.name}</h1>
          <p className="text-base text-muted">{p.description}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="text-[13px] text-muted">Масса нетто</span><span className="tag">{p.weight_g} г</span>
            {p.temp_sensitive && <span className="tag tag-warn"><Icon name="thermo" className="size-3.5" />чувствителен к температуре</span>}
          </div>
          <div className="mt-6 flex items-center justify-between"><span className="text-[30px] font-semibold">{rub(p.price_rub)}</span><span className="text-[13px] text-muted">{p.manufacturer}</span></div>
          <ProductActions product={p} />
          <Note className="mt-4">{w ? <>Доставим сборной отправкой <b>{w.title}</b>. Ближайшая волна: сбор до {fmtDate(w.cutoff)}, отправка {fmtDate(w.departure)}, получение {fmtRange(w.arrival_from, w.arrival_to)}. Сейчас тариф {w.rate} ₽/кг.</> : 'Ближайшая волна уточняется.'}</Note>
          {p.temp_sensitive && <Note kind="warn" className="mt-3">{severe ? 'В сезон отправки шоколадным изделиям обязательна термоупаковка.' : 'Шоколадное изделие: в холодный и жаркий сезон добавим термоупаковку. Сейчас — по желанию.'}</Note>}
        </div>
      </div>
      <hr className="my-10 border-line" />
      <div className="grid gap-12 md:grid-cols-2">
        <div><h3 className="h3">Состав и важная информация</h3><p className="mt-3 text-[13px] text-muted">{p.composition}</p><p className="mt-3 text-[13px] text-accent">Не используйте пример состава при аллергии. Точную информацию уточним по упаковке производителя.</p></div>
        <div><h3 className="h3 mb-3">Перед заказом</h3>
          <Kv k="Регион" v={region.name} /><Kv k="Производитель" v={p.manufacturer} /><Kv k="Масса нетто" v={`${p.weight_g} г`} /><Kv k="Срок годности" v={`${p.shelf_life_days} сут`} /><Kv k="Артикул" v={p.id} />
        </div>
      </div>
      <hr className="my-10 border-line" />
      <h2 className="h2 mb-6">Добавьте к чаепитию</h2>
      <div className="grid grid-cols-2 gap-x-3 gap-y-5 md:grid-cols-4 md:gap-x-4.5">{related.filter((x) => x.id !== p.id).slice(0, 4).map((x) => <ProductCard key={x.id} p={x} />)}</div>
    </div>
  );
}
