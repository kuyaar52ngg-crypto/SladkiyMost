import { api } from '../api.js';
import { state, setProfile, addToCart } from '../state.js';
import { icon, esc, rub, note, crumbs, statusTag, toast, formData } from '../ui.js';
import { ORDER_STATUSES, DIRECTIONS, fmtDate, fmtRange, kg } from '../../shared/logic.js';
import { go, refreshChrome } from '../app.js';

const DEMO_PHONE = '+7 (914) 123-45-67';

function sideNav(active) {
  const p = state.profile;
  return `<aside>
    <div class="card card--soft">${icon('user')}<p class="mt-8" style="font-weight:600">${esc(p?.name || 'Гость')}</p><p class="small muted">${esc(p?.phone || '')}</p></div>
    <nav class="account-nav mt-16">
      <a href="#/orders" class="${active === 'orders' ? 'active' : ''}">Мои заказы</a>
      <a href="#/favorites">Избранное</a>
      <a href="#/catalog">Каталог</a>
      <a href="#/login?logout=1">Выйти</a>
    </nav>
  </aside>`;
}

export function track(o) {
  if (o.status === 'cancelled') return note('Заказ отменён. Деньги возвращены (имитация).');
  const idx = ORDER_STATUSES.findIndex((s) => s.id === o.status);
  const w = o.wave;
  const hint = {
    accepted: w ? `сбор до ${fmtDate(w.cutoff)}` : '',
    assembling: w ? `отправка ${fmtDate(w.departure)}` : '',
    transit: w ? `в пути ${fmtRange(w.departure, w.arrivalTo)}` : '',
    pickup: w ? `ориентир ${fmtRange(w.arrivalFrom, w.arrivalTo)}` : '',
    received: '',
  };
  return `<div class="track">${ORDER_STATUSES.map((s, i) => {
    const h = o.history.filter((x) => x.status === s.id).pop();
    const cls = i < idx ? 'done' : i === idx ? 'cur' : '';
    return `<div class="track__step ${cls}"><i>${i < idx ? icon('check') : i + 1}</i><b>${s.title}</b><span class="xs muted">${h ? fmtDate(h.date) : hint[s.id]}</span></div>`;
  }).join('')}</div>`;
}

function orderCard(o, full = false) {
  const w = o.wave;
  return `<article class="card order-card">
    <div class="row between"><div><h3 style="margin:0">Заказ № ${esc(o.id)}</h3><p class="small muted mt-8">${fmtDate(o.created, true)} · ${o.gift ? 'подарок' : o.kind === 'b2b' ? 'для организации' : 'для себя'} · ${DIRECTIONS[o.direction].title}</p></div>${statusTag(o.status, o.status_title)}</div>
    ${track(o)}
    ${o.items.map((i) => `<div class="order-line"><img src="${esc(i.photo)}" alt=""><div><b class="small">${esc(i.name)}</b><p class="xs muted">${i.weight_g} г · ${i.qty} шт.</p></div><b class="small">${rub(i.price_rub * i.qty)}</b></div>`).join('')}
    <p class="small mt-12">${esc(o.recipient.name)} · ${esc(o.recipient.address)}</p>
    ${w ? `<p class="xs muted mt-8">Волна: сбор до ${fmtDate(w.cutoff)} · отправка ${fmtDate(w.departure)} · получение ${fmtRange(w.arrivalFrom, w.arrivalTo)}, ориентировочно</p>` : ''}
    ${full ? '' : `<div class="row between mt-16"><div><b class="price">${rub(o.total_rub)}</b><p class="xs muted">включая доставку ${rub(o.delivery_rub)}${o.refund_rub ? ` · вернём ${rub(o.refund_rub)}` : ''}</p></div><a class="btn" href="#/orders/${encodeURIComponent(o.id)}">Подробнее</a></div>`}
  </article>`;
}

export async function orders({ query }) {
  if (!state.profile) return login({ query: { next: 'orders' } });
  const list = await api('GET', `/api/orders?phone=${encodeURIComponent(state.profile.phone)}`);
  const f = query.f || 'all';
  const activeIds = ['accepted', 'assembling', 'transit', 'pickup'];
  const shown = list.filter((o) => f === 'all' || (f === 'active' ? activeIds.includes(o.status) : !activeIds.includes(o.status)));
  const cnt = (fn) => list.filter(fn).length;
  return `<div class="container page">
    ${crumbs([['Главная', '#/'], ['Личный кабинет'], ['Мои заказы']])}
    <div class="page-head"><h1>Мои заказы</h1><p>Ваши сладости в пути — все детали и статусы в одном месте.</p></div>
    <div class="account">
      ${sideNav('orders')}
      <div>
        <div class="chips" style="margin-bottom:16px">
          <a class="chip ${f === 'all' ? 'active' : ''}" href="#/orders">Все · ${list.length}</a>
          <a class="chip ${f === 'active' ? 'active' : ''}" href="#/orders?f=active">Активные · ${cnt((o) => activeIds.includes(o.status))}</a>
          <a class="chip ${f === 'done' ? 'active' : ''}" href="#/orders?f=done">Завершённые · ${cnt((o) => !activeIds.includes(o.status))}</a>
        </div>
        ${shown.length ? shown.map((o) => orderCard(o)).join('') : `<div class="empty card card--soft"><h3>Заказов пока нет</h3><p class="muted">Здесь появятся заказы, оформленные на номер ${esc(state.profile.phone)}.</p><a class="btn btn--primary mt-16" href="#/catalog">Выбрать сладости</a></div>`}
      </div>
    </div>
  </div>`;
}

export async function orderDetail({ params }) {
  let o;
  try { o = await api('GET', `/api/orders/${encodeURIComponent(params[0])}`); } catch (e) {
    return `<div class="container page"><div class="empty"><h3>Заказ не найден</h3><p class="muted">Проверьте номер заказа.</p><a class="btn mt-16" href="#/orders">К заказам</a></div></div>`;
  }
  const w = o.wave;
  const html = `<div class="container page">
    ${crumbs([['Главная', '#/'], ['Мои заказы', '#/orders'], [`Заказ ${o.id}`]])}
    <div class="layout-aside">
      <div>
        ${o.status === 'accepted' ? `<div style="margin-bottom:16px">${note('Заказ принят. Ждём закрытия сбора — после этого соберём партию и пришлём итоговый расчёт доставки.')}</div>` : ''}
        ${orderCard(o, true)}
        ${o.gift ? `<div class="card mt-16"><h3>Открытка ${icon('gift')}</h3><div class="postcard postcard--${esc(o.gift.card)}"><p class="postcard__to">${esc(o.recipient.name.split(' ')[0])},</p><p class="postcard__msg">${esc(o.gift.message)}</p><p class="postcard__sign">${esc(o.gift.signature)}</p></div>${o.gift.surprise ? '<p class="small muted mt-12">Сюрприз: свяжемся с вами перед вручением.</p>' : ''}</div>` : ''}
        <div class="card mt-16"><h3>История</h3>${o.history.slice().reverse().map((h) => `<div class="kv"><span>${fmtDate(h.date, true)} · ${esc(ORDER_STATUSES.find((s) => s.id === h.status)?.title || 'Отменён')}</span><span class="small muted">${esc(h.note || '')}</span></div>`).join('')}</div>
      </div>
      <aside class="aside">
        <div class="card card--soft"><h3>Сумма</h3>
          <div class="kv"><span>Товары</span><b>${rub(o.goods_rub)}</b></div>
          <div class="kv"><span>Доставка (${kg(o.weight_kg)} × ${o.rate_rub} ₽)</span><b>${rub(o.delivery_rub)}</b></div>
          ${o.thermo_rub ? `<div class="kv"><span>Термоупаковка</span><b>${rub(o.thermo_rub)}</b></div>` : ''}
          ${o.receive_rub ? `<div class="kv"><span>Курьер</span><b>${rub(o.receive_rub)}</b></div>` : ''}
          ${o.gift_rub ? `<div class="kv"><span>Коробка и открытка</span><b>${rub(o.gift_rub)}</b></div>` : ''}
          <hr class="divider"><div class="total"><span>Оплачено</span><b>${rub(o.total_rub)}</b></div>
          ${o.final_delivery_rub !== undefined ? `<div class="mt-12">${note(o.refund_rub ? `Сбор закрыт: итоговая доставка ${rub(o.final_delivery_rub)}. Вернём ${rub(o.refund_rub)}.` : `Сбор закрыт: доставка подтверждена — ${rub(o.final_delivery_rub)}.`, 'ok')}</div>` : ''}
          <p class="xs muted mt-12">${esc(o.payment.method)} · ${esc(o.payment.note)}</p>
        </div>
        ${w ? `<div class="card"><h3>Волна</h3><p>${w.title}</p><p class="small muted mt-8">Отправка ${fmtDate(w.departure)} · получение ${fmtRange(w.arrivalFrom, w.arrivalTo)}${w.offSeason ? ' (межсезонье +7 дн.)' : ''}</p></div>` : ''}
        <button class="btn btn--block" id="repeat">Повторить заказ</button>
        ${o.status === 'accepted' ? '<button class="btn btn--ghost btn--block" id="cancel">Отменить заказ</button>' : ''}
      </aside>
    </div>
  </div>`;
  const mount = (root) => {
    root.querySelector('#repeat').onclick = () => { o.items.forEach((i) => addToCart(i.id, i.qty)); refreshChrome(); go('#/cart'); };
    root.querySelector('#cancel')?.addEventListener('click', async (e) => {
      const b = e.currentTarget;
      if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = 'Точно отменить? Нажмите ещё раз'; return; }
      try { await api('POST', `/api/orders/${encodeURIComponent(o.id)}/cancel`, { phone: state.profile?.phone || o.customer.phone }); toast('Заказ отменён'); go(location.hash); }
      catch (ex) { toast(ex.message); }
    });
  };
  return { html, mount };
}

export function login({ query }) {
  if (query.logout) { setProfile(null); }
  const html = `<div class="container page" style="max-width:960px">
    <div class="grid-2" style="gap:32px;align-items:start">
      <div class="card"><h2>Вход</h2><p class="muted mt-8">Войдите по номеру телефона, чтобы видеть свои заказы и подарки.</p>
        <form id="login" class="stack mt-16" novalidate>
          <label class="field"><span>Имя</span><input class="input" name="name" autocomplete="name" placeholder="Анна"></label>
          <label class="field"><span>Телефон *</span><input class="input" name="phone" type="tel" autocomplete="tel" placeholder="+7 (___) ___-__-__" required></label>
          <p class="error-text" id="err"></p>
          <button class="btn btn--primary btn--block">Войти</button>
          <button type="button" class="link-btn" id="demo">Демо-покупатель: ${DEMO_PHONE}</button>
        </form>
        <p class="xs muted mt-16">В MVP вход упрощён: код из СМС имитируется.</p>
      </div>
      <div class="card card--soft"><h3>Отследить заказ</h3><p class="small muted">Знаете номер заказа? Введите его — покажем статус.</p>
        <form id="trackf" class="row mt-16" style="flex-wrap:nowrap"><input class="input" name="num" placeholder="СМ-1025" aria-label="Номер заказа"><button class="btn">Найти</button></form>
        <img src="img/gift.jpg" alt="" class="mt-24" style="border-radius:12px;aspect-ratio:3/2;object-fit:cover;width:100%">
      </div>
    </div>
  </div>`;
  const mount = (root) => {
    const f = root.querySelector('#login');
    root.querySelector('#demo').onclick = () => { f.name.value = 'Анна Морозова'; f.phone.value = DEMO_PHONE; };
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = formData(f);
      if (v.phone.replace(/\D/g, '').length < 10) { root.querySelector('#err').textContent = 'Введите номер телефона полностью'; return; }
      setProfile({ name: v.name || 'Покупатель', phone: v.phone });
      go('#/' + (query.next || 'orders'));
    });
    root.querySelector('#trackf').addEventListener('submit', (e) => {
      e.preventDefault();
      const id = e.target.num.value.trim().toUpperCase().replace(/^CM/, 'СМ').replace(/^СМ(\d)/, 'СМ-$1');
      if (id) go(`#/orders/${encodeURIComponent(id)}`);
    });
  };
  return { html, mount };
}
