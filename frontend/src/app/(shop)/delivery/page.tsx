import type { Metadata } from 'next';
import { Calculator } from '@/features/delivery/Calculator';
import { get } from '@/shared/api/client';
import type { Meta, Wave } from '@/shared/api/types';
import { rub } from '@/shared/lib/format';
import { Crumbs, Kv, PageHead } from '@/shared/ui';
import { WaveSummary } from '@/widgets/WaveSummary';

export const metadata: Metadata = { title: 'Сборная доставка' };

export default async function DeliveryPage() {
  const [meta, waves] = await Promise.all([get<Meta>('/api/meta'), get<Wave[]>('/api/waves?only_open=true')]);
  const p = meta.policy;
  const seasons = [['Декабрь — февраль', 'Обязательная термоупаковка для шоколадных изделий (мороз)'], ['Июнь — август', 'Обязательная термоупаковка для шоколадных изделий (перегрев)'], ['Май, ноябрь', 'Межсезонье: срок доставки +7 дней'], ['Март — апрель, сентябрь — октябрь', 'Ограничений нет']];
  return (
    <div className="container-x pt-7 pb-20">
      <Crumbs items={[['Главная', '/'], ['Сборная доставка']]} />
      <PageHead title="Сборная доставка" text="Между Якутском и Донецком более 7 000 км. Чтобы доставка не стоила дороже сладостей, мы собираем заказы в общие партии — «волны»." />
      <div className="grid gap-4 md:grid-cols-2">
        {Object.values(meta.directions).map((d) => (
          <div key={d.id}><h3 className="h3 mb-3.5">{d.title}</h3><div className="space-y-3">{waves.filter((w) => w.direction === d.id).slice(0, 3).map((w) => <WaveSummary key={w.id} w={w} max={p.max_load_kg} />)}</div></div>
        ))}
      </div>
      <div id="rules" className="mt-8 grid items-start gap-6 md:grid-cols-2">
        <div className="card"><h3 className="h3 mb-4">Правила волн</h3>
          <Kv k="Периодичность" v={`1 раз в ${p.wave_interval_days} дней в каждом направлении`} />
          <Kv k="Окончание приёма" v={`за ${p.cutoff_days_before} дня до отправки`} />
          <Kv k="Срок доставки" v={`${p.transit_days.join('–')} дней`} />
          <Kv k="Загрузка партии" v={`от ${p.min_load_kg} до ${p.max_load_kg} кг`} />
          <Kv k="Термоупаковка" v={`${rub(p.thermo_price)} за заказ`} />
          <Kv k="Пункт выдачи / курьер" v={`бесплатно / ${rub(p.courier_price)}`} />
          <p className="mt-3 text-[13px] text-muted">Если к закрытию приёма партия не набрала {p.min_load_kg} кг, заказы переносятся в следующую волну — с уведомлением и без доплаты. Оплата — имитация.</p>
        </div>
        <div className="card"><h3 className="h3 mb-4">Тариф от заполнения партии</h3>
          <table className="w-full text-sm"><thead><tr className="text-left text-[13px] text-muted"><th className="py-2.5 font-semibold">Заполнение партии</th><th className="font-semibold">Скидка</th><th className="font-semibold">Тариф</th></tr></thead>
            <tbody className="[&_td]:border-t [&_td]:border-line [&_td]:py-2.5">
              <tr><td>до 50% (до {p.max_load_kg / 2} кг)</td><td>—</td><td>{p.base_tariff} ₽/кг</td></tr>
              {[...p.discounts].reverse().map(([t, pc]) => <tr key={t}><td>более {t * 100}% ({t * p.max_load_kg}+ кг)</td><td>−{pc}%</td><td>{p.base_tariff * (1 - pc / 100)} ₽/кг</td></tr>)}
            </tbody></table>
          <p className="formula mt-4">Доставка = вес заказа × тариф</p>
          <p className="text-[13px] text-muted">Вес = масса нетто × {p.packaging_factor} (упаковка), минимум {p.min_billable_kg} кг. Тариф считается по загрузке партии вместе с вашим заказом. При закрытии сбора пересчитываем по факту: если тариф снизился — возвращаем разницу.</p>
        </div>
      </div>
      <div className="mt-6 grid items-start gap-6 md:grid-cols-2">
        <div className="card"><h3 className="h3 mb-4">Сезонность</h3>{seasons.map(([m, t]) => <div key={m} className="flex justify-between gap-4 py-1.5 text-sm"><span>{m}</span><span className="text-right">{t}</span></div>)}
          <p className="mt-3 text-[13px] text-muted">Сезон определяется по месяцу отправки и ожидаемого прибытия партии.</p></div>
        <Calculator waves={waves} />
      </div>
    </div>
  );
}
