'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Layout, Loading, NeedItems, Summary, useCheckoutItems, useOrderBlock } from '@/features/checkout/common';
import { lines, other, useShop } from '@/features/shop/store';
import { get, post } from '@/shared/api/client';
import type { Address, Order, QuoteResponse } from '@/shared/api/types';
import { cn, fmtDate, fmtRange, kg, rub } from '@/shared/lib/format';
import { Crumbs, Kv, Note, PageHead, Steps, Total } from '@/shared/ui';

const CARDS: Record<string, [string, string]> = {
  classic: ['Классическая', 'bg-pink'],
  berry: ['Северная ягода', 'bg-gradient-to-br from-[#fbf0f1] to-[#f6e1e4]'],
  snow: ['Зимняя', 'bg-gradient-to-br from-[#eef4f8] to-[#fdfdfd]'],
  sun: ['Южное солнце', 'bg-gradient-to-br from-[#fdf3e5] to-[#fbe8d3]'],
};

export default function FormPage() {
  const { ready, items, origin } = useCheckoutItems();
  const block = useOrderBlock(items);
  const { meta, draft, setDraft, profile, setProfile, clearRegion, toast, user } = useShop();
  const router = useRouter();
  const [r, setR] = useState<QuoteResponse | null>(null);
  const [customer, setCustomer] = useState({ name: '', phone: '' });
  const [payment, setPayment] = useState('card');
  const [consent, setConsent] = useState(false);
  const [shown, setShown] = useState<string[]>([]);  // поля, для которых уже показываем ошибки
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const key = JSON.stringify(lines(items));
  const receive = draft.receive || 'pickup';

  useEffect(() => { const c = user || profile; if (c) setCustomer({ name: c.name, phone: c.phone }); }, [user, profile]);
  // покупатель с аккаунтом: основной адрес из кабинета подставляется в получателя
  useEffect(() => {
    if (!user || draft.recipient_name) return;
    get<Address[]>('/api/account/addresses').then((l) => {
      const a = l.find((x) => x.is_default) || l[0];
      if (a && !draft.recipient_name) setDraft({ recipient_name: a.name, recipient_phone: a.phone, address: draft.address || `${a.city}, ${a.line}` });
    }).catch(() => null);
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!ready || !items.length) return;
    if (!draft.wave_id) { router.replace('/checkout/wave'); return; }
    post<QuoteResponse>('/api/quote', { items: JSON.parse(key), wave_id: draft.wave_id, thermo: !!draft.thermo, gift: !!draft.gift, receive })
      .then(setR).catch((e) => { toast(e.message); router.replace('/checkout/wave'); });
  }, [ready, key, items.length, draft.wave_id, draft.thermo, draft.gift, receive, router, toast]);

  if (!ready) return <Loading />;
  if (!items.length || !origin) return <NeedItems />;
  if (!r) return <Loading />;
  const { wave: w, quote: q } = r;
  const to = meta.regions[other(origin)];
  const card = draft.gift_card || 'classic';
  const phoneOk = (v?: string) => { const d = (v || '').replace(/\D/g, ''); return d.length === 10 || d.length === 11; };
  const errors: Record<string, string> = {};
  if ((customer.name || '').trim().length < 2) errors.c_name = 'Укажите имя и фамилию';
  if (!phoneOk(customer.phone)) errors.c_phone = 'Введите номер телефона полностью';
  if ((draft.recipient_name || '').trim().length < 2) errors.r_name = 'Укажите имя получателя';
  if (!phoneOk(draft.recipient_phone)) errors.r_phone = 'Введите номер телефона полностью';
  if (receive === 'courier' && !(draft.address || '').trim()) errors.address = 'Укажите адрес получения';
  if ((draft.gift_message || '').length > 200) errors.gift = 'Текст открытки — не более 200 знаков';
  if (!consent) errors.consent = 'Примите условия заказа и обработки персональных данных';
  const bad = (f: string) => shown.includes(f) && !!errors[f];
  const touch = (f: string) => setShown((x) => (x.includes(f) ? x : [...x, f]));
  const Err = ({ f }: { f: string }) => (bad(f) ? <span role="alert" className="text-xs text-accent">{errors[f]}</span> : null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const missing = Object.keys(errors);
    setShown(missing);
    if (missing.length) {
      setError('Заказ пока не отправлен. Исправьте отмеченные поля, затем повторите отправку.');
      document.getElementById('checkout-errors')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setBusy(true); setError('');
    try {
      const order = await post<Order>('/api/orders', {
        items: lines(items), wave_id: draft.wave_id, thermo: !!draft.thermo, gift: !!draft.gift, receive,
        customer_name: customer.name, customer_phone: customer.phone,
        recipient_name: draft.recipient_name, recipient_phone: draft.recipient_phone,
        address: draft.address || '', pickup_point: draft.pickup_point || '',
        gift_message: draft.gift_message || '', gift_signature: draft.gift_signature || '', gift_card: card,
        gift_surprise: !!draft.gift_surprise, b2b: !!draft.b2b, company: draft.company || '', payment, consent,
      });
      setProfile({ name: customer.name, phone: customer.phone });
      clearRegion(origin);
      setDraft({ origin: null, wave_id: null, gift: false, gift_message: '', gift_signature: '', gift_surprise: false, recipient_name: '', recipient_phone: '', address: '', thermo: false, b2b: false, company: '' });
      router.push(`/success/${encodeURIComponent(order.code)}`);
    } catch (ex) {
      const m = (ex as Error).message;
      setError(m === 'Failed to fetch' ? 'Не удалось отправить заказ: нет соединения. Данные сохранены в форме — проверьте интернет и повторите отправку.' : m);
      setBusy(false);
    }
  };

  const inp = (f: string) => cn('input', bad(f) && 'input-invalid');

  return (
    <div className="container-x pt-7 pb-20">
      <Crumbs items={[['Главная', '/'], ['Корзина', '/cart'], ['Отправка', '/checkout/wave'], ['Расчёт', '/checkout/calc'], ['Оформление']]} />
      <PageHead title={draft.gift ? 'Подарочный заказ' : 'Оформление заказа'} text={draft.gift ? 'Соберите тёплое послание из любимых сладостей и ваших слов.' : 'Данные покупателя и получателя.'} />
      <Steps current={4} />
      <form onSubmit={submit} noValidate>
        <Layout
          main={<div className="space-y-4">
            <div className="card"><h3 className="h3 mb-4">1. Ваши контакты</h3>
              {user === null && <p className="-mt-2 mb-4 text-[13px] text-muted"><Link className="text-accent underline" href="/login?next=/checkout/form">Войдите</Link>, чтобы заказ сохранился в личном кабинете, — или оформите без регистрации.</p>}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="field"><span className="label">Ваше имя *</span><input className={inp('c_name')} autoComplete="name" value={customer.name} onBlur={() => touch('c_name')} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} /><Err f="c_name" /></label>
                <label className="field"><span className="label">Ваш телефон *</span><input className={inp('c_phone')} type="tel" autoComplete="tel" placeholder="+7 (___) ___-__-__" value={customer.phone} onBlur={() => touch('c_phone')} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} /><Err f="c_phone" /></label>
              </div>
              <label className="check mt-4"><input type="checkbox" checked={!!draft.b2b} onChange={(e) => setDraft({ b2b: e.target.checked })} />Заказ от организации (корпоративный набор)</label>
              {draft.b2b && <label className="field mt-3"><span className="label">Организация</span><input className="input" value={draft.company || ''} onChange={(e) => setDraft({ company: e.target.value })} /></label>}
            </div>

            <div className="card"><h3 className="h3 mb-4">2. Подарок</h3>
              <label className="check"><input type="checkbox" checked={!!draft.gift} onChange={(e) => setDraft({ gift: e.target.checked })} />Это подарок — добавить открытку и коробку с лентой · +{rub(meta.policy.gift_box_price)}</label>
              {draft.gift && <div className="mt-4">
                <span className="label">Дизайн открытки</span>
                <div className="mt-2 flex flex-wrap gap-2.5">{Object.entries(CARDS).map(([k, [t, bg]]) => (
                  <button key={k} type="button" title={t} aria-label={t} aria-pressed={card === k} onClick={() => setDraft({ gift_card: k })} className={cn('h-12 w-[70px] rounded-lg border-2', bg, card === k ? 'border-accent' : 'border-transparent')} />
                ))}</div>
                <label className="field mt-4"><span className="label">Ваши слова на открытке</span>
                  <textarea className="input min-h-24 resize-y" maxLength={200} placeholder="Мама, пусть этот подарок напомнит о наших чаепитиях…" value={draft.gift_message || ''} onChange={(e) => setDraft({ gift_message: e.target.value })} />
                  <span className="hint">{(draft.gift_message || '').length}/200 знаков. Текст перенесём на открытку без изменений.</span></label>
                <label className="field mt-3"><span className="label">Подпись отправителя</span><input className="input" maxLength={60} value={draft.gift_signature || ''} onChange={(e) => setDraft({ gift_signature: e.target.value })} /></label>
                <label className="check mt-3"><input type="checkbox" checked={!!draft.gift_surprise} onChange={(e) => setDraft({ gift_surprise: e.target.checked })} />Сначала свяжитесь со мной — подарок должен быть сюрпризом</label>
              </div>}
            </div>

            <div className="card"><h3 className="h3 mb-4">3. Получатель · {to.name}</h3>
              {!draft.gift && <p className="-mt-2 mb-3 text-[13px] text-muted">Заказ для себя? Укажите себя — получите сладости в {to.city === 'Якутск' ? 'Якутске' : 'Донецке'} или области.</p>}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="field"><span className="label">Имя и фамилия *</span><input className={inp('r_name')} value={draft.recipient_name || ''} onBlur={() => touch('r_name')} onChange={(e) => setDraft({ recipient_name: e.target.value })} /><Err f="r_name" /></label>
                <label className="field"><span className="label">Телефон получателя *</span><input className={inp('r_phone')} type="tel" placeholder="+7 (___) ___-__-__" value={draft.recipient_phone || ''} onBlur={() => touch('r_phone')} onChange={(e) => setDraft({ recipient_phone: e.target.value })} />{bad('r_phone') ? <Err f="r_phone" /> : <span className="hint">Нужен для согласования получения</span>}</label>
              </div>
              <button type="button" className="link mt-2" onClick={() => setDraft({ recipient_name: customer.name, recipient_phone: customer.phone })}>Получатель — я</button>
              {receive === 'courier'
                ? <label className="field mt-4"><span className="label">Адрес доставки *</span><input className={inp('address')} placeholder={`${to.city}, улица, дом, квартира`} value={draft.address || ''} onBlur={() => touch('address')} onChange={(e) => setDraft({ address: e.target.value })} /><Err f="address" /></label>
                : <div className="field mt-4"><span className="label">Пункт выдачи</span><div className="input bg-soft">{draft.pickup_point}</div><Link className="hint" href="/checkout/calc">Изменить способ получения</Link></div>}
            </div>

            <div className="card"><h3 className="h3 mb-4">4. Оплата</h3>
              <div className="space-y-2.5">{[['card', 'Банковская карта', 'Visa, МИР'], ['sbp', 'СБП', 'Оплата по QR-коду']].map(([v, t, s]) => (
                <label key={v} className={cn('flex cursor-pointer gap-3 rounded-card border p-4', payment === v ? 'border-accent bg-pink' : 'border-line')}>
                  <input type="radio" className="mt-0.5 size-[18px] accent-accent" checked={payment === v} onChange={() => setPayment(v)} /><div><b>{t}</b><p className="text-[13px] text-muted">{s}</p></div>
                </label>))}</div>
              <Note className="mt-3">Онлайн-оплата в MVP — имитация (заглушка): реальные деньги не списываются.</Note>
              <label className={cn('check mt-4', bad('consent') && 'text-accent')}><input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); touch('consent'); }} />Согласен(на) с условиями заказа и обработкой персональных данных</label>
              <Err f="consent" />
            </div>
            {error && (
              <div id="checkout-errors" role="alert" className="rounded-card border-l-4 border-accent bg-pink px-5 py-4 text-sm">
                <b className="block text-accent">Заказ пока не отправлен</b>{error}
                {Object.keys(errors).length > 0 && shown.length > 0 && <ul className="mt-2 list-disc pl-5 text-[13px]">{Object.entries(errors).filter(([f]) => shown.includes(f)).map(([f, m]) => <li key={f}>{m}</li>)}</ul>}
              </div>
            )}
          </div>}
          aside={<>
            {draft.gift && (
              <div className={cn('rounded-card p-6', CARDS[card][1])}>
                <p className="text-xs text-muted">Ваша открытка</p>
                <p className="mt-2 mb-3 font-head text-[22px] text-accent">{(draft.recipient_name || 'Получатель').split(' ')[0]},</p>
                <p className="text-sm whitespace-pre-wrap">{draft.gift_message || 'Здесь появятся ваши тёплые слова…'}</p>
                <p className="mt-3.5 text-[13px] font-semibold">{draft.gift_signature || customer.name}</p>
              </div>
            )}
            <div className="card-soft"><h3 className="h3 mb-4">Ваш заказ</h3>
              <Summary items={items}>
                <Kv k={`Доставка (${kg(q.weight_kg)} × ${q.rate} ₽)`} v={rub(q.delivery_rub)} />
                {q.thermo_rub > 0 && <Kv k="Термоупаковка" v={rub(q.thermo_rub)} />}
                {q.receive_rub > 0 && <Kv k="Курьер" v={rub(q.receive_rub)} />}
                {q.gift_rub > 0 && <Kv k="Коробка и открытка" v={rub(q.gift_rub)} />}
                <hr className="divider" /><Total label="Итого к оплате" value={rub(q.total_rub)} />
              </Summary>
              {block && <p role="alert" className="mt-4 text-[13px] text-accent">{block}</p>}
              <button className="btn btn-primary mt-4 w-full" type="submit" disabled={busy || !!block}>{busy ? 'Оплачиваем…' : 'Оплатить и оформить'}</button>
              <p className="mt-3 text-xs text-muted">Сбор до {fmtDate(w.cutoff)}, отправка {fmtDate(w.departure)}, получение {fmtRange(w.arrival_from, w.arrival_to)}.</p>
            </div>
          </>}
        />
      </form>
    </div>
  );
}
