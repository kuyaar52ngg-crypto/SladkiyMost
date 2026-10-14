'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useOrders } from '@/features/account/data';
import { AccountHead } from '@/features/account/page';
import { Card, ORDER_PILL } from '@/features/account/parts';
import { useShop } from '@/features/shop/store';
import { put } from '@/shared/api/client';
import type { GiftDraft, User } from '@/shared/api/types';
import { fmtDate } from '@/shared/lib/format';

const LIMIT = 200;
const EMPTY: GiftDraft = { recipient_name: '', recipient_phone: '', address: '', message: '', contact_first: true };

export default function AccountGifts() {
  const { user, setUser, setDraft, toast } = useShop();
  const router = useRouter();
  const [orders] = useOrders();
  const [d, setD] = useState<GiftDraft>(user?.gift_draft || EMPTY);
  const [err, setErr] = useState('');
  if (!user) return null;
  const gifts = (orders || []).filter((o) => o.kind === 'gift');
  const saved = user.gift_draft;
  const over = d.message.length > LIMIT;

  const save = async (e?: FormEvent) => {
    e?.preventDefault();
    if (over) { setErr(`Текст открытки — не более ${LIMIT} знаков`); return false; }
    try { setUser(await put<User>('/api/account/gift-draft', d)); setErr(''); toast('Черновик сохранён'); return true; }
    catch (ex) { setErr((ex as Error).message); return false; }
  };
  const use = (g: GiftDraft) => {
    setDraft({ gift: true, recipient_name: g.recipient_name, recipient_phone: g.recipient_phone, address: g.address, gift_message: g.message, gift_surprise: g.contact_first });
    router.push('/gift');
  };

  return (
    <>
      <AccountHead title="Подарки и открытки" />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card title="Сохранённая открытка">
          <div className="relative aspect-[424/220] overflow-hidden rounded-card"><Image src="/img/gift.jpg" alt="Подарочная коробка со сладостями" fill sizes="480px" className="object-cover" /></div>
          {saved && (saved.message || saved.recipient_name) ? (
            <>
              <span className="pill pill-soft mt-4">Черновик{saved.recipient_name ? ` · для ${saved.recipient_name}` : ''}</span>
              <p className="mt-4 font-head text-[22px] font-bold">{(saved.recipient_name || 'Дорогой человек').split(' ')[0]},</p>
              <p className="mt-3 text-[15px] whitespace-pre-wrap">{saved.message || 'Текст открытки пока не написан.'}</p>
              <p className="mt-3 font-semibold">{user.name.split(' ')[0]}</p>
              <button type="button" className="btn btn-primary mt-5" onClick={() => use(saved)}>Использовать открытку</button>
            </>
          ) : <p className="mt-4 text-[15px] text-muted">Напишите тёплые слова заранее — сохраним черновик, и при оформлении подарка открытка подставится сама.</p>}
        </Card>

        <form onSubmit={save} noValidate className="rounded-card border border-line p-6">
          <h2 className="h3 mb-5">Получатель и ваши слова</h2>
          <div className="space-y-4">
            <label className="field"><span className="label">Получатель</span><input className="input" value={d.recipient_name} onChange={(e) => setD({ ...d, recipient_name: e.target.value })} /></label>
            <label className="field"><span className="label">Телефон</span><input className="input" type="tel" placeholder="+7 (___) ___-__-__" value={d.recipient_phone} onChange={(e) => setD({ ...d, recipient_phone: e.target.value })} /></label>
            <label className="field"><span className="label">Адрес</span><input className="input" placeholder="Регион, город, улица, дом" value={d.address} onChange={(e) => setD({ ...d, address: e.target.value })} /></label>
            <label className="field"><span className="label">Текст открытки · до {LIMIT} знаков</span>
              <textarea className={`input min-h-[110px] resize-y ${over ? 'input-invalid' : ''}`} value={d.message} onChange={(e) => setD({ ...d, message: e.target.value })} />
              <span className={over ? 'text-xs text-accent' : 'hint'}>{d.message.length}/{LIMIT}{over && ' — сократите текст'}</span></label>
            <label className="check"><input type="checkbox" checked={d.contact_first} onChange={(e) => setD({ ...d, contact_first: e.target.checked })} />Сначала связаться со мной</label>
          </div>
          {err && <p role="alert" className="mt-4 text-[13px] text-accent">{err}</p>}
          <div className="mt-6 flex flex-wrap gap-3">
            <button className="btn btn-primary">Сохранить черновик</button>
            <button type="button" className="btn" onClick={async () => { if (await save()) use(d); }}>Собрать подарок</button>
          </div>
        </form>
      </div>

      <Card className="mt-6" title="Прошлые подарки">
        {gifts.length ? (
          <div className="overflow-x-auto">
            <table className="table-x min-w-[560px]">
              <thead><tr><th>Заказ</th><th>Получатель</th><th>Состав</th><th>Статус</th></tr></thead>
              <tbody>{gifts.map((o) => (
                <tr key={o.code}>
                  <td><Link className="font-semibold hover:text-accent" href={`/account/orders/${encodeURIComponent(o.code)}`}>{o.code}</Link><span className="block text-[13px] text-muted">{fmtDate(o.created_at, true)}</span></td>
                  <td>{o.recipient.name}</td>
                  <td>{o.items.map((i) => `${i.name} × ${i.qty}`).join(', ')}</td>
                  <td className="text-accent">{ORDER_PILL[o.status]}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p className="text-[15px] text-muted">Подарков пока не было. <Link className="text-accent underline underline-offset-2" href="/gift">Собрать первый подарок</Link></p>}
      </Card>
    </>
  );
}
