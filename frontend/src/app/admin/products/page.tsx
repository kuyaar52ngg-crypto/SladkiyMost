'use client';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AdminHead, paginate, Pager, Panel } from '@/features/admin/ui';
import { useShop } from '@/features/shop/store';
import { ImageUploader } from '@/features/upload/ImageUploader';
import { del, get, post, put } from '@/shared/api/client';
import type { Product, RegionId } from '@/shared/api/types';
import { cn, rub } from '@/shared/lib/format';
import { Empty, Icon, Photo } from '@/shared/ui';

type Draft = Omit<Product, 'id' | 'photo'> & { id?: string };

export default function ProductsAdmin() {
  const { meta, toast } = useShop();
  const [list, setList] = useState<Product[] | null>(null);
  const [edit, setEdit] = useState<Draft | null>(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [pub, setPub] = useState('');
  const [region, setRegion] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const load = useCallback(() => get<Product[]>('/api/admin/products').then(setList), []);
  useEffect(() => { load(); }, [load]);

  const blank: Draft = { name: '', region: 'YKT', manufacturer: '', category: meta.categories[0], weight_g: 200, price_rub: 300, temp_sensitive: false, shelf_life_days: 30, photos: [], description: '', composition: '', tag: '', active: true };
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    const { id, ...body } = edit;
    if (!body.photos.length) { setErr('Добавьте хотя бы одно фото'); return; }
    try {
      await (id ? put(`/api/admin/products/${id}`, body) : post('/api/admin/products', body));
      setEdit(null); setErr(''); toast('Товар сохранён'); load();
    } catch (ex) { setErr((ex as Error).message); }
  };
  const setActive = async (p: Product, active: boolean) => {
    await post(`/api/admin/products/${p.id}/active`, { active });
    toast(active ? 'Товар снова в каталоге' : 'Товар скрыт из каталога'); load();
  };
  const remove = async (p: Product) => {
    if (!confirm(`Удалить «${p.name}»? Если по товару уже есть заказы, он будет только скрыт.`)) return;
    try {
      const r = await del<{ deleted: boolean }>(`/api/admin/products/${p.id}`);
      toast(r.deleted ? 'Товар удалён' : 'По товару есть заказы — товар скрыт из каталога'); load();
    } catch (ex) { toast((ex as Error).message); }
  };
  const open = (p: Product) => setEdit({ ...p, photos: p.photos.length ? p.photos : [p.photo] });
  if (!list) return <p className="text-muted">Загружаем…</p>;
  const f = <K extends keyof Draft>(k: K, v: Draft[K]) => setEdit((x) => (x ? { ...x, [k]: v } : x));

  const term = q.trim().toLowerCase();
  const shown = list.filter((p) => (!pub || (pub === 'on') === p.active) && (!region || p.region === region) && (!category || p.category === category)
    && (!term || `${p.id} ${p.name} ${p.manufacturer}`.toLowerCase().includes(term)));
  const { rows, pages, page: cur } = paginate(shown, page, 12);
  const on = list.filter((p) => p.active).length;
  return (
    <>
      <AdminHead title="Общий каталог товаров" text="Товары, фото и публикация на витрине. Скрытый товар не виден покупателям, но остаётся в истории заказов.">
        <button className="btn btn-primary" onClick={() => setEdit(blank)}><Icon name="box" className="size-4" />Добавить товар</button>
      </AdminHead>
      <Panel>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="field"><span className="label">Поиск по товарам</span><input className="input" placeholder="Название, артикул, производитель" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></label>
          <label className="field"><span className="label">Публикация</span><select className="select" value={pub} onChange={(e) => { setPub(e.target.value); setPage(1); }}><option value="">Все</option><option value="on">Опубликованы</option><option value="off">Скрыты</option></select></label>
          <label className="field"><span className="label">Регион</span><select className="select" value={region} onChange={(e) => { setRegion(e.target.value); setPage(1); }}><option value="">Все регионы</option>{Object.entries(meta.regions).map(([k, r]) => <option key={k} value={k}>{r.name}</option>)}</select></label>
          <label className="field"><span className="label">Категория</span><select className="select" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}><option value="">Все категории</option>{meta.categories.map((c) => <option key={c}>{c}</option>)}</select></label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2"><button type="button" className="pill pill-soft" onClick={() => { setQ(''); setPub(''); setRegion(''); setCategory(''); setPage(1); }}>Сбросить фильтры</button></div>
      </Panel>
      <div className="mt-5 flex flex-wrap gap-2">
        {([['', `Все · ${list.length}`], ['on', `Опубликованы · ${on}`], ['off', `Скрыты · ${list.length - on}`]] as const).map(([k, t]) => <button key={k || 'all'} type="button" className={cn('pill', pub !== k && 'pill-soft')} onClick={() => { setPub(k); setPage(1); }}>{t}</button>)}
      </div>
      {!list.length ? <div className="mt-4"><Empty title="Товаров пока нет" text="Добавьте первую сладость — она сразу появится в каталоге и на главной." /></div> : (
      <div className="mt-4 overflow-x-auto">
        <table className="table-x min-w-[860px]">
          <thead><tr><th>Фото / название</th><th>Производитель / регион</th><th>Категория / цена</th><th>Публикация / действия</th></tr></thead>
          <tbody>{rows.map((p) => (
            <tr key={p.id}>
              <td><div className="flex items-center gap-3"><div className="relative size-12 shrink-0 overflow-hidden rounded-md bg-soft"><Photo src={p.photo} alt="" sizes="48px" /></div>
                <div><b className="text-sm">{p.name}</b><span className="block text-xs text-muted">{p.id} · {p.weight_g} г{p.temp_sensitive && ' · термо'}</span></div></div></td>
              <td>{p.manufacturer || '—'}<span className="block text-xs text-muted">{meta.regions[p.region].name}</span></td>
              <td>{p.category}<b className="block">{rub(p.price_rub)}</b></td>
              <td><span className={cn('pill', p.active ? 'pill-soft' : 'pill-fill')}>{p.active ? 'Опубликован' : 'Скрыт'}</span>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[13px]">
                  <button type="button" className="text-accent" onClick={() => open(p)}>Изменить</button>
                  <button type="button" className="text-accent" onClick={() => setActive(p, !p.active)}>{p.active ? 'Скрыть' : 'Опубликовать'}</button>
                  <button type="button" className="text-muted hover:text-accent" onClick={() => remove(p)}>Удалить</button>
                </div></td>
            </tr>
          ))}{!rows.length && <tr><td colSpan={4} className="text-muted">Товаров не найдено</td></tr>}</tbody>
        </table>
      </div>)}
      <Pager page={cur} pages={pages} total={shown.length} shown={rows.length} onPage={setPage} />
      {edit && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-ink/35 p-4" onClick={(e) => e.target === e.currentTarget && setEdit(null)}>
          <form onSubmit={save} role="dialog" aria-modal="true" className="max-h-[90vh] w-full max-w-[640px] space-y-3 overflow-auto rounded-card bg-white p-6">
            <div className="flex items-center justify-between"><h2 className="h2">{edit.id ? 'Изменить товар' : 'Новый товар'}</h2><button type="button" aria-label="Закрыть" onClick={() => setEdit(null)}><Icon name="x" /></button></div>
            <label className="field"><span className="label">Название *</span><input className="input" required value={edit.name} onChange={(e) => f('name', e.target.value)} /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="field"><span className="label">Регион</span><select className="select" value={edit.region} onChange={(e) => f('region', e.target.value as RegionId)}>{Object.entries(meta.regions).map(([k, r]) => <option key={k} value={k}>{r.name}</option>)}</select></label>
              <label className="field"><span className="label">Категория</span><select className="select" value={edit.category} onChange={(e) => f('category', e.target.value)}>{meta.categories.map((c) => <option key={c}>{c}</option>)}</select></label>
            </div>
            <label className="field"><span className="label">Производитель</span><input className="input" value={edit.manufacturer} onChange={(e) => f('manufacturer', e.target.value)} /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="field"><span className="label">Масса нетто, г *</span><input className="input" type="number" min={1} required value={edit.weight_g} onChange={(e) => f('weight_g', Number(e.target.value))} /></label>
              <label className="field"><span className="label">Цена, ₽ *</span><input className="input" type="number" min={1} required value={edit.price_rub} onChange={(e) => f('price_rub', Number(e.target.value))} /></label>
              <label className="field"><span className="label">Срок годности, сут</span><input className="input" type="number" min={1} value={edit.shelf_life_days} onChange={(e) => f('shelf_life_days', Number(e.target.value))} /></label>
            </div>
            <ImageUploader value={edit.photos} onChange={(v) => f('photos', v)} />
            <label className="field"><span className="label">Метка</span><input className="input" placeholder="Например: Хит" value={edit.tag} onChange={(e) => f('tag', e.target.value)} /></label>
            <label className="field"><span className="label">Описание</span><textarea className="input min-h-20" value={edit.description} onChange={(e) => f('description', e.target.value)} /></label>
            <label className="field"><span className="label">Состав</span><textarea className="input min-h-20" value={edit.composition} onChange={(e) => f('composition', e.target.value)} /></label>
            <label className="check"><input type="checkbox" checked={edit.temp_sensitive} onChange={(e) => f('temp_sensitive', e.target.checked)} />Чувствителен к температуре (шоколад)</label>
            {err && <p className="text-xs text-accent">{err}</p>}
            <button className="btn btn-primary w-full">Сохранить</button>
          </form>
        </div>
      )}
    </>
  );
}
