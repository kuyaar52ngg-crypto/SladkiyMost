import { api } from '../api.js';
import { state, cartItems, setQty, setDraft, clearOrigin, setProfile } from '../state.js';
import { icon, esc, rub, note, crumbs, steps, fillBar, toast, formData, plural } from '../ui.js';
import { CONFIG, REGIONS, DIRECTIONS, fmtDate, fmtRange, kg, quote, netWeightKg, billableWeightKg } from '../../shared/logic.js';
import { go, refreshChrome } from '../app.js';

const other = (r) => (r === 'YKT' ? 'DNR' : 'YKT');
const dirOf = (origin) => `${origin}-${other(origin)}`;
const plainItems = (items) => items.map((i) => ({ id: i.id, qty: i.qty }));

function summary(items, extra = '') {
  const goods = items.reduce((s, i) => s + i.price_rub * i.qty, 0);
  const n = items.reduce((s, i) => s + i.qty, 0);
  return `<div class="kv"><span>Товары · ${n} шт.</span><b>${rub(goods)}</b></div>
    <div class="kv"><span>Вес товаров (нетто)</span><b>${kg(netWeightKg(items))}</b></div>${extra}`;
}

function guard(origin) {
  const items = origin ? cartItems(origin) : [];
  if (!origin || !items.length) return { redirect: true, html: `<div class="container page"><div class="empty"><h3>Сначала выберите сладости</h3><p class="muted">Корзина для этой отправки пуста.</p><a class="btn btn--primary mt-16" href="#/cart">В корзину</a></div></div>` };
  return { items };
}

// ---------------- Корзина ----------------
export function cart() {
  const groups = ['YKT', 'DNR'].map((r) => ({ origin: r, items: cartItems(r) })).filter((g) => g.items.length);
  if (!groups.length) {
    return `<div class="container page">${crumbs([['Главная', '#/'], ['Корзина']])}
      <div class="empty card card--soft"><h3>Корзина пока пуста</h3><p class="muted">Выберите сладости Якутии или Донбасса — а мы подберём ближайшую сборную отправку.</p>
      <div class="row mt-24" style="justify-content:center"><a class="btn btn--primary" href="#/catalog">В каталог</a><a class="btn" href="#/gift">Собрать подарок</a></div></div></div>`;
  }
  const html = `<div class="container page">
    ${crumbs([['Главная', '#/'], ['Корзина']])}
    <div class="page-head"><h1>Корзина</h1><p>Сладости едут сборными отправками из региона производителя в регион получателя.</p></div>
    ${steps(1)}
    <div class="layout-aside">
      <div>
        ${groups.map((g) => {
          const goods = g.items.reduce((s, i) => s + i.price_rub * i.qty, 0);
          const net = netWeightKg(g.items);
          const choc = g.items.some((i) => i.temp_sensitive);
          return `<section class="card cart-group">
            <div class="row between"><h3 style="margin:0">${DIRECTIONS[dirOf(g.origin)].title}</h3><span class="tag">${REGIONS[g.origin].showcase}</span></div>
            <p class="small muted mt-8">Получатель — в регионе «${REGIONS[other(g.origin)].name}» (${REGIONS[other(g.origin)].city} и область).</p>
            <div class="mt-12">${g.items.map((i) => `<div class="cart-item">
              <img src="${esc(i.photo)}" alt="">
              <div><a class="cart-item__name" href="#/product/${i.id}">${esc(i.name)}</a><p class="small muted">${i.weight_g} г · ${rub(i.price_rub)} ${i.temp_sensitive ? '· <span class="snow">шоколад</span>' : ''}</p>
                <button class="link-btn mt-8" data-del="${i.id}">Удалить</button></div>
              <div class="qty qty--sm"><button data-q="${i.id}" data-d="-1" aria-label="Меньше">−</button><span>${i.qty}</span><button data-q="${i.id}" data-d="1" aria-label="Больше">+</button></div>
              <b class="nowrap">${rub(i.price_rub * i.qty)}</b>
            </div>`).join('')}</div>
            ${choc ? `<div class="mt-12">${note('В отправке есть шоколадные изделия — подскажем, нужна ли термоупаковка по сезону на шаге расчёта.', 'warn')}</div>` : ''}
            <div class="row between mt-16"><div><p class="small muted">Товары: <b style="color:var(--ink)">${rub(goods)}</b> · вес нетто ${kg(net)} · с упаковкой ≈ ${kg(billableWeightKg(net))}</p></div>
              <button class="btn btn--primary" data-go="${g.origin}">Выбрать отправку ${icon('arrow')}</button></div>
          </section>`;
        }).join('')}
      </div>
      <aside class="aside">
        <div class="card card--soft"><h3>Ваш заказ</h3>${summary(groups.flatMap((g) => g.items))}
          <hr class="divider"><p class="small muted">Стоимость доставки рассчитаем на следующем шаге — она зависит от веса и заполнения выбранной волны.</p></div>
        ${groups.length > 1 ? note('В корзине сладости двух регионов — это две отправки в разные стороны. Оформите их по очереди.') : ''}
        ${state.draft.gift ? note(`Оформляем как подарок ${icon('gift')}. Открытку заполните на шаге «Оформление».`) : ''}
      </aside>
    </div>
  </div>`;
  const mount = (root) => {
    root.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => {
      const it = state.cart.find((i) => i.id === b.dataset.q);
      setQty(b.dataset.q, it.qty + +b.dataset.d); go('#/cart');
    }));
    root.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { setQty(b.dataset.del, 0); toast('Товар удалён'); go('#/cart'); }));
    root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => {
      const origin = b.dataset.go;
      if (state.draft.origin !== origin) setDraft({ origin, wave_id: null, gift: state.draft.gift && state.draft.origin === origin });
      go('#/checkout/wave');
    }));
  };
  return { html, mount };
}

// ---------------- Шаг 2. Выбор волны ----------------
export async function wave() {
  const origin = state.draft.origin;
  const g = guard(origin);
  if (g.redirect) return g.html;
  const items = g.items;
  const dir = dirOf(origin);
  const waves = await api('GET', `/api/waves?upcoming=1&direction=${dir}`);
  const open = waves.filter((w) => w.open);
  let selected = open.find((w) => w.id === state.draft.wave_id) || open[0];
  const to = REGIONS[other(origin)];
  const card = (w) => {
    const q = quote({ items, wave: w });
    const sel = selected && w.id === selected.id;
    const disabled = !w.open || !q.fits;
    const status = !w.open ? (w.status === 'collecting' ? 'Партия заполнена' : 'Сбор закрыт') : sel ? 'Выбрана' : w.fill > 0.8 ? 'Почти заполнена' : 'Идёт сбор';
    return `<label class="wave ${sel ? 'selected' : ''} ${disabled ? 'disabled' : ''}">
      <div class="wave__head"><span class="wave__title"><input type="radio" name="wave" value="${w.id}" ${sel ? 'checked' : ''} ${disabled ? 'disabled' : ''}>${DIRECTIONS[dir].title}</span>
        <span class="tag ${disabled ? 'tag--muted' : ''}">${status}</span></div>
      <div class="wave__grid">
        <div><span>Сбор заказов</span>${w.open ? `До ${fmtDate(w.cutoff)} <span class="small muted">(${w.days_left} ${plural(w.days_left, 'день', 'дня', 'дней')})</span>` : `Завершён ${fmtDate(w.cutoff)}`}</div>
        <div><span>Отправка</span>${fmtDate(w.departure)}</div>
        <div><span>Получение, ориентир</span>${fmtRange(w.arrivalFrom, w.arrivalTo)}${w.offSeason ? ' <span class="tag tag--warn">+7 дн.</span>' : ''}</div>
      </div>
      ${fillBar(w.load_kg, w.open ? q.weightKg : 0, CONFIG.maxLoadKg)}
      <div class="fill-legend"><span>В партии ${kg(w.load_kg)} из ${CONFIG.maxLoadKg}${w.open ? ` + ваши ${kg(q.weightKg)}` : ''}</span><span>${w.open ? `Тариф с вашим заказом: <b class="accent">${q.rate} ₽/кг</b>` : `Итоговый тариф ${w.rate} ₽/кг`}</span></div>
      ${w.open ? `<p class="small accent mt-8">Для вашей корзины ${kg(q.weightKg)} · доставка ≈ ${rub(q.delivery)}${q.saving ? ` (экономия ${rub(q.saving)})` : ''}. ${!q.minReached ? `До минимума отправки ${CONFIG.minLoadKg} кг осталось ${kg(CONFIG.minLoadKg - q.projectedLoad)}.` : ''}</p>` : ''}
    </label>`;
  };
  const html = `<div class="container page">
    ${crumbs([['Главная', '#/'], ['Корзина', '#/cart'], ['Выбор сборной отправки']])}
    <div class="page-head"><h1>Выбор сборной отправки</h1><p>Найдём попутную волну для ваших сладостей.</p></div>
    ${steps(2)}
    <div class="layout-aside">
      <div>
        <div class="card"><h3>Куда отправляем?</h3>
          <div class="grid-2">
            <div class="field"><span>Регион отправления</span><div class="input" style="background:var(--bg-soft)">${REGIONS[origin].name}</div><span class="hint">По составу корзины</span></div>
            <label class="field"><span>Регион получения</span><div class="input" style="background:var(--bg-soft)">${to.name} · ${to.city} и область</div><span class="hint">Сладости едут к получателю в другой регион</span></label>
          </div>
        </div>
        <div class="row between mt-24" style="margin-bottom:14px"><h3 style="margin:0">Отправки в ${to.name === 'Якутия' ? 'Якутию' : 'Донбасс'}</h3><span class="tag tag--muted">Каждые ${CONFIG.waveIntervalDays} дней</span></div>
        <div id="waves">${waves.map(card).join('')}</div>
        <div class="mt-16">${note(`Приём заказов закрывается за ${CONFIG.cutoffDaysBefore} дня до отправки. Если партия не наберёт ${CONFIG.minLoadKg} кг, перенесём заказ в следующую волну без доплаты.`)}</div>
        <a class="btn mt-24" href="#/cart">${icon('back')} Вернуться в корзину</a>
      </div>
      <aside class="aside">
        <div class="card card--soft"><h3>Ваш заказ</h3><div id="sum"></div>
          <button class="btn btn--primary btn--block mt-16" id="next" ${selected ? '' : 'disabled'}>Рассчитать доставку</button>
          <p class="xs muted mt-12">Предварительный расчёт. Деньги сейчас не списываются.</p></div>
      </aside>
    </div>
  </div>`;
  const mount = (root) => {
    const renderSum = () => {
      if (!selected) { root.querySelector('#sum').innerHTML = summary(items) + note('Нет открытых волн — загляните позже.'); return; }
      const q = quote({ items, wave: selected });
      root.querySelector('#sum').innerHTML = summary(items, `<div class="kv"><span>Доставка, предварительно</span><b>${rub(q.delivery)}</b></div><hr class="divider"><div class="total"><span>Предварительный итог</span><b>${rub(q.goods + q.delivery)}</b></div>`);
    };
    root.querySelectorAll('input[name=wave]').forEach((r) => r.addEventListener('change', () => {
      selected = open.find((w) => w.id === r.value);
      setDraft({ wave_id: selected.id });
      root.querySelector('#waves').innerHTML = waves.map(card).join('');
      mount(root);
    }));
    renderSum();
    root.querySelector('#next').onclick = () => { setDraft({ wave_id: selected.id }); go('#/checkout/calc'); };
  };
  return { html, mount };
}

// ---------------- Шаг 3. Расчёт доставки ----------------
export async function calc() {
  const origin = state.draft.origin;
  const g = guard(origin);
  if (g.redirect) return g.html;
  if (!state.draft.wave_id) { go('#/checkout/wave'); return ''; }
  let res;
  try {
    res = await api('POST', '/api/quote', { items: plainItems(g.items), wave_id: state.draft.wave_id, thermo: state.draft.thermo, receive: state.draft.receive, gift: state.draft.gift });
  } catch (e) { toast(e.message); go('#/checkout/wave'); return ''; }
  const w = res.wave;
  if (!w.open) { toast('Приём в эту волну закрыт — выберите другую'); setDraft({ wave_id: null }); go('#/checkout/wave'); return ''; }
  const to = other(origin);
  const points = state.meta.pickupPoints[to];
  const d = state.draft;
  const html = `<div class="container page">
    ${crumbs([['Главная', '#/'], ['Корзина', '#/cart'], ['Отправка', '#/checkout/wave'], ['Расчёт стоимости доставки']])}
    <div class="page-head"><h1>Расчёт стоимости доставки</h1><p>Показываем, из чего складывается ваша доля в сборной отправке.</p></div>
    ${steps(3)}
    <div class="layout-aside">
      <div>
        <div class="card"><h3>Параметры расчёта</h3>
          <div class="row between"><p>${w.title} · отправка ${fmtDate(w.departure)} · получение ${fmtRange(w.arrivalFrom, w.arrivalTo)}</p><a class="btn btn--sm" href="#/checkout/wave">Изменить</a></div>
        </div>
        <div class="card card--pink mt-16" id="breakdown"></div>
        <div class="card mt-16"><h3>Сезон и упаковка</h3><div id="season"></div></div>
        <div class="card mt-16"><h3>Получение: ${REGIONS[to].city} и область</h3>
          <label class="radio-card ${d.receive !== 'courier' ? 'selected' : ''}"><input type="radio" name="receive" value="pickup" ${d.receive !== 'courier' ? 'checked' : ''}><div class="grow"><div class="row between"><b>В пункте выдачи</b><b>бесплатно</b></div>
            <select class="select mt-12" id="pickup">${points.map((p) => `<option ${d.pickup_point === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></div></label>
          <label class="radio-card ${d.receive === 'courier' ? 'selected' : ''}"><input type="radio" name="receive" value="courier" ${d.receive === 'courier' ? 'checked' : ''}><div class="grow"><div class="row between"><b>Курьером до адреса</b><b>${rub(CONFIG.courierPrice)}</b></div><p class="small muted mt-8">Адрес укажете при оформлении.</p></div></label>
        </div>
        <div class="mt-16">${note('Если при закрытии сбора тариф снизится — вернём разницу. Выше указанной суммы доставка не станет.')}</div>
      </div>
      <aside class="aside">
        <div class="card"><h3>Ваша доставка</h3><div id="dsum"></div></div>
        <div class="card card--soft"><h3>Ваш заказ</h3><div id="osum"></div>
          <button class="btn btn--primary btn--block mt-16" id="next">Перейти к оформлению</button>
          <p class="xs muted mt-12">Пример расчёта. Сейчас деньги не списываются.</p></div>
      </aside>
    </div>
  </div>`;
  const mount = (root) => {
    const update = () => {
      const dd = state.draft;
      const q = quote({ items: g.items, wave: w, thermo: dd.thermo, gift: dd.gift, receive: dd.receive });
      const rows = [[`до 50%`, CONFIG.baseTariff], ['более 50%', CONFIG.baseTariff * 0.8], ['более 80%', CONFIG.baseTariff * 0.65]];
      root.querySelector('#breakdown').innerHTML = `<h3>Как распределяются расходы</h3><span class="tag">Предварительный расчёт</span>
        <div class="big-stats mt-16"><div><b>${kg(w.load_kg)}</b><span class="small muted">уже в партии</span></div><div><b>${kg(q.weightKg)}</b><span class="small muted">ваш заказ с упаковкой</span></div><div><b>${Math.round(q.fill * 100)}%</b><span class="small muted">заполнение с вашим заказом</span></div></div>
        ${fillBar(w.load_kg, q.weightKg, CONFIG.maxLoadKg)}
        <div class="fill-legend"><span>0</span><span>50% · −20%</span><span>80% · −35%</span><span>${CONFIG.maxLoadKg} кг</span></div>
        <hr class="divider">
        <p class="formula">${kg(q.weightKg)} × ${q.rate} ₽/кг = ${rub(q.delivery)}</p>
        <p class="small muted">Вес: ${kg(q.netKg)} нетто × ${CONFIG.packagingFactor} на упаковку. Отдельной посылкой по базовому тарифу — ${rub(q.baseDelivery)}${q.saving ? `, сборная отправка экономит <b class="accent">${rub(q.saving)}</b>` : ''}.</p>
        ${q.next ? `<p class="small mt-8">Ещё ${kg(q.next.needKg)} в партии — и тариф для всех участников станет ${q.next.rate} ₽/кг. Пересчитаем при закрытии сбора.</p>` : ''}
        <table class="tariff-table mt-16"><thead><tr><th>Заполнение</th><th>Тариф</th></tr></thead><tbody>${rows.map(([t, r]) => `<tr class="${r === q.rate ? 'on' : ''}"><td>${t}</td><td>${r} ₽/кг</td></tr>`).join('')}</tbody></table>`;
      root.querySelector('#season').innerHTML = (q.thermo.required
        ? note(`${q.thermo.reason} Термоупаковка добавлена: +${rub(CONFIG.thermoPrice)}.`, 'warn')
        : `<label class="check"><input type="checkbox" id="thermo" ${dd.thermo ? 'checked' : ''}> Добавить термоупаковку · +${rub(CONFIG.thermoPrice)}</label>
           <p class="small muted mt-8">${q.thermo.sensitive ? q.thermo.reason : 'В заказе нет шоколадных изделий — термоупаковка не обязательна.'}</p>`)
        + (w.offSeason ? `<div class="mt-12">${note('Межсезонье (ледостав/ледоход на Лене): срок доставки увеличен на 7 дней — уже учтено в датах.', 'warn')}</div>` : '');
      root.querySelector('#thermo')?.addEventListener('change', (e) => { setDraft({ thermo: e.target.checked }); update(); });
      root.querySelector('#dsum').innerHTML = `<div class="kv"><span>Доля перевозки</span><b>${rub(q.delivery)}</b></div>
        ${q.thermo.cost ? `<div class="kv"><span>Термоупаковка</span><b>${rub(q.thermo.cost)}</b></div>` : ''}
        <div class="kv"><span>${dd.receive === 'courier' ? 'Курьер' : 'Пункт выдачи'}</span><b>${q.receiveCost ? rub(q.receiveCost) : 'бесплатно'}</b></div>
        <hr class="divider"><div class="total"><span>Доставка</span><b>${rub(q.delivery + q.thermo.cost + q.receiveCost)}</b></div>
        <p class="xs muted mt-8">Ориентир получения: ${fmtRange(w.arrivalFrom, w.arrivalTo)}.</p>`;
      root.querySelector('#osum').innerHTML = summary(g.items, `<div class="kv"><span>Доставка и упаковка</span><b>${rub(q.delivery + q.thermo.cost + q.receiveCost)}</b></div>
        ${q.giftCost ? `<div class="kv"><span>Подарочная коробка</span><b>${rub(q.giftCost)}</b></div>` : ''}
        <hr class="divider"><div class="total"><span>Итого</span><b>${rub(q.total)}</b></div>`);
    };
    root.querySelectorAll('input[name=receive]').forEach((r) => r.addEventListener('change', () => {
      setDraft({ receive: r.value });
      root.querySelectorAll('.radio-card').forEach((c) => c.classList.toggle('selected', c.contains(root.querySelector('input[name=receive]:checked'))));
      update();
    }));
    const pk = root.querySelector('#pickup');
    if (!state.draft.pickup_point || !points.includes(state.draft.pickup_point)) setDraft({ pickup_point: points[0] });
    pk.addEventListener('change', () => setDraft({ pickup_point: pk.value }));
    root.querySelector('#next').onclick = () => go('#/checkout/form');
    update();
  };
  return { html, mount };
}

// ---------------- Шаг 4. Оформление ----------------
const CARDS = { classic: 'Классическая', berry: 'Северная ягода', snow: 'Зимняя', sun: 'Южное солнце' };

export async function form() {
  const origin = state.draft.origin;
  const g = guard(origin);
  if (g.redirect) return g.html;
  if (!state.draft.wave_id) { go('#/checkout/wave'); return ''; }
  const { wave: w } = await api('POST', '/api/quote', { items: plainItems(g.items), wave_id: state.draft.wave_id });
  const d = state.draft;
  const pr = state.profile || {};
  const r = d.recipient || {};
  const to = REGIONS[other(origin)];
  const html = `<div class="container page">
    ${crumbs([['Главная', '#/'], ['Корзина', '#/cart'], ['Отправка', '#/checkout/wave'], ['Расчёт', '#/checkout/calc'], ['Оформление']])}
    <div class="page-head"><h1>${d.gift ? 'Подарочный заказ' : 'Оформление заказа'}</h1><p>${d.gift ? 'Соберите тёплое послание из любимых сладостей и ваших слов.' : 'Данные покупателя и получателя.'}</p></div>
    ${steps(4)}
    <form class="layout-aside" id="order" novalidate>
      <div class="stack">
        <div class="card"><h3>1. Ваши контакты</h3>
          <div class="grid-2"><label class="field"><span>Ваше имя *</span><input class="input" name="c_name" autocomplete="name" value="${esc(pr.name || '')}" required></label>
          <label class="field"><span>Ваш телефон *</span><input class="input" name="c_phone" type="tel" autocomplete="tel" placeholder="+7 (___) ___-__-__" value="${esc(pr.phone || '')}" required></label></div>
          <label class="check mt-16"><input type="checkbox" name="b2b" ${d.b2b ? 'checked' : ''}> Заказ от организации (корпоративный набор)</label>
          <label class="field mt-12" id="company-f" ${d.b2b ? '' : 'hidden'}><span>Организация</span><input class="input" name="company" value="${esc(d.company || '')}"></label>
        </div>

        <div class="card"><h3>2. Подарок</h3>
          <label class="check"><input type="checkbox" name="gift" ${d.gift ? 'checked' : ''}> Это подарок — добавить открытку и коробку с лентой · +${rub(CONFIG.giftBoxPrice)}</label>
          <div id="gift-f" class="mt-16" ${d.gift ? '' : 'hidden'}>
            <span class="label">Дизайн открытки</span>
            <div class="card-designs mt-8">${Object.entries(CARDS).map(([k, t]) => `<button type="button" class="card-design postcard--${k} ${(d.giftCard || 'classic') === k ? 'on' : ''}" data-card="${k}" title="${t}" aria-label="${t}" style="${k === 'classic' ? 'background:var(--bg-pink)' : ''}"></button>`).join('')}</div>
            <label class="field mt-16"><span>Ваши слова на открытке</span><textarea class="textarea" name="giftMessage" maxlength="200" placeholder="Мама, пусть этот подарок напомнит о наших чаепитиях…">${esc(d.giftMessage || '')}</textarea><span class="hint" id="cnt">До 200 знаков. Текст перенесём на открытку без изменений.</span></label>
            <label class="field mt-12"><span>Подпись отправителя</span><input class="input" name="giftSignature" maxlength="60" value="${esc(d.giftSignature || '')}"></label>
            <label class="check mt-12"><input type="checkbox" name="giftSurprise" ${d.giftSurprise ? 'checked' : ''}> Сначала свяжитесь со мной — подарок должен быть сюрпризом</label>
          </div>
        </div>

        <div class="card"><h3>3. Получатель · ${to.name}</h3>
          ${!d.gift ? `<p class="small muted" style="margin:-8px 0 12px">Заказ для себя? Укажите себя — получите сладости в ${to.city === 'Якутск' ? 'Якутске' : 'Донецке'} или области.</p>` : ''}
          <div class="grid-2"><label class="field"><span>Имя и фамилия *</span><input class="input" name="r_name" value="${esc(r.name || '')}" required></label>
          <label class="field"><span>Телефон получателя *</span><input class="input" name="r_phone" type="tel" value="${esc(r.phone || '')}" required><span class="hint">Нужен для согласования получения</span></label></div>
          <button type="button" class="link-btn mt-8" id="me">Получатель — я</button>
          ${d.receive === 'courier'
            ? `<label class="field mt-16"><span>Адрес доставки *</span><input class="input" name="r_address" value="${esc(r.address || '')}" placeholder="${to.city}, улица, дом, квартира" required></label>`
            : `<div class="field mt-16"><span>Пункт выдачи</span><div class="input" style="background:var(--bg-soft)">${esc(d.pickup_point || '')}</div><a class="hint" href="#/checkout/calc">Изменить способ получения</a></div>`}
        </div>

        <div class="card"><h3>4. Оплата</h3>
          <label class="radio-card selected"><input type="radio" name="payment" value="card" checked><div><b>Банковская карта</b><p class="small muted">Visa, МИР</p></div></label>
          <label class="radio-card"><input type="radio" name="payment" value="sbp"><div><b>СБП</b><p class="small muted">Оплата по QR-коду</p></div></label>
          <div class="mt-12">${note('Онлайн-оплата в MVP — имитация (заглушка): реальные деньги не списываются.')}</div>
          <label class="check mt-16"><input type="checkbox" name="consent" required> Согласен(на) с условиями заказа и обработкой персональных данных</label>
        </div>
        <p class="error-text" id="err" role="alert"></p>
      </div>
      <aside class="aside">
        <div id="postcard-wrap" ${d.gift ? '' : 'hidden'}><div class="card" style="padding:0;border:0"><div class="postcard" id="postcard"></div></div></div>
        <div class="card card--soft"><h3>Ваш заказ</h3><div id="osum"></div>
          <button class="btn btn--primary btn--block mt-16" type="submit" id="submit">Оплатить и оформить</button>
          <p class="xs muted mt-12">Сбор до ${fmtDate(w.cutoff)}, отправка ${fmtDate(w.departure)}, получение ${fmtRange(w.arrivalFrom, w.arrivalTo)}.</p></div>
      </aside>
    </form>
  </div>`;

  const mount = (root) => {
    const f = root.querySelector('#order');
    const sync = () => {
      const v = formData(f);
      setDraft({
        gift: v.gift, giftMessage: v.giftMessage, giftSignature: v.giftSignature, giftSurprise: v.giftSurprise, b2b: v.b2b, company: v.company,
        recipient: { name: v.r_name, phone: v.r_phone, address: v.r_address ?? state.draft.recipient?.address },
      });
      root.querySelector('#gift-f').hidden = !v.gift;
      root.querySelector('#postcard-wrap').hidden = !v.gift;
      root.querySelector('#company-f').hidden = !v.b2b;
      const dd = state.draft;
      const pc = root.querySelector('#postcard');
      pc.className = `postcard postcard--${dd.giftCard || 'classic'}`;
      pc.innerHTML = `<p class="xs muted">Ваша открытка</p><p class="postcard__to mt-8">${esc((v.r_name || 'Получатель').split(' ')[0])},</p><p class="postcard__msg">${esc(v.giftMessage || 'Здесь появятся ваши тёплые слова…')}</p><p class="postcard__sign">${esc(v.giftSignature || v.c_name || '')}</p>`;
      root.querySelector('#cnt').textContent = `${(v.giftMessage || '').length}/200 знаков. Текст перенесём на открытку без изменений.`;
      const q = quote({ items: g.items, wave: w, thermo: dd.thermo, gift: dd.gift, receive: dd.receive });
      root.querySelector('#osum').innerHTML = summary(g.items, `<div class="kv"><span>Доставка (${kg(q.weightKg)} × ${q.rate} ₽)</span><b>${rub(q.delivery)}</b></div>
        ${q.thermo.cost ? `<div class="kv"><span>Термоупаковка</span><b>${rub(q.thermo.cost)}</b></div>` : ''}
        ${q.receiveCost ? `<div class="kv"><span>Курьер</span><b>${rub(q.receiveCost)}</b></div>` : ''}
        ${q.giftCost ? `<div class="kv"><span>Коробка и открытка</span><b>${rub(q.giftCost)}</b></div>` : ''}
        <hr class="divider"><div class="total"><span>Итого к оплате</span><b>${rub(q.total)}</b></div>`);
    };
    f.addEventListener('input', sync);
    root.querySelectorAll('[data-card]').forEach((b) => b.addEventListener('click', () => {
      setDraft({ giftCard: b.dataset.card });
      root.querySelectorAll('[data-card]').forEach((x) => x.classList.toggle('on', x === b));
      sync();
    }));
    root.querySelectorAll('input[name=payment]').forEach((r) => r.addEventListener('change', () => root.querySelectorAll('input[name=payment]').forEach((x) => x.closest('.radio-card').classList.toggle('selected', x.checked))));
    root.querySelector('#me').onclick = () => { f.r_name.value = f.c_name.value; f.r_phone.value = f.c_phone.value; sync(); };
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = formData(f);
      const err = root.querySelector('#err');
      f.querySelectorAll('.invalid').forEach((x) => x.classList.remove('invalid'));
      const missing = [...f.querySelectorAll('[required]')].filter((x) => (x.type === 'checkbox' ? !x.checked : !x.value.trim()));
      if (missing.length) { missing.forEach((x) => x.classList.add('invalid')); err.textContent = 'Заполните обязательные поля и подтвердите согласие.'; missing[0].focus(); return; }
      const btn = root.querySelector('#submit');
      btn.disabled = true; btn.textContent = 'Оплачиваем…';
      const dd = state.draft;
      try {
        const { order } = await api('POST', '/api/orders', {
          items: plainItems(g.items), wave_id: dd.wave_id, thermo: dd.thermo, gift: v.gift, receive: dd.receive,
          customer: { name: v.c_name, phone: v.c_phone },
          recipient: { name: v.r_name, phone: v.r_phone, address: v.r_address, pickup_point: dd.pickup_point },
          giftMessage: v.giftMessage, giftSignature: v.giftSignature, giftCard: dd.giftCard, giftSurprise: v.giftSurprise,
          b2b: v.b2b, company: v.company, payment: v.payment, consent: v.consent,
        });
        setProfile({ name: v.c_name, phone: v.c_phone });
        clearOrigin(origin);
        setDraft({ origin: null, wave_id: null, gift: false, giftMessage: '', giftSignature: '', giftSurprise: false, recipient: {}, thermo: false, b2b: false, company: '' });
        refreshChrome();
        go(`#/success/${encodeURIComponent(order.id)}`);
      } catch (ex) {
        err.textContent = ex.message;
        btn.disabled = false; btn.textContent = 'Оплатить и оформить';
      }
    });
    sync();
  };
  return { html, mount };
}

// ---------------- Успех ----------------
export async function success({ params }) {
  const o = await api('GET', `/api/orders/${encodeURIComponent(params[0])}`);
  const w = o.wave;
  return `<div class="container page" style="max-width:820px">
    <div class="card" style="text-align:center;padding:40px 24px">
      <span class="feature__icon" style="margin:0 auto;width:64px;height:64px">${icon('check')}</span>
      <h1 class="mt-16" style="font-size:clamp(28px,4vw,40px)">Заказ ${esc(o.id)} оформлен</h1>
      <p class="muted mt-12">${o.gift ? `Подарок для ${esc(o.recipient.name)} отправится с волной ${w.title}.` : `Ваши сладости поедут волной ${w.title}.`} Мы пришлём уведомления о каждом этапе.</p>
      <div class="big-stats mt-24" style="text-align:left">
        <div class="card card--soft"><span class="small muted">Сбор до</span><b style="font-size:20px">${fmtDate(w.cutoff)}</b></div>
        <div class="card card--soft"><span class="small muted">Отправка</span><b style="font-size:20px">${fmtDate(w.departure)}</b></div>
        <div class="card card--soft"><span class="small muted">Получение</span><b style="font-size:20px">${fmtRange(w.arrivalFrom, w.arrivalTo)}</b></div>
      </div>
      <div class="mt-24" style="text-align:left">${note(`Оплачено ${rub(o.total_rub)} (имитация). Доставка ${rub(o.delivery_rub)} по тарифу ${o.rate_rub} ₽/кг — при закрытии сбора пересчитаем по фактической загрузке и вернём разницу, если станет дешевле.`, 'ok')}</div>
      <div class="row mt-24" style="justify-content:center"><a class="btn btn--primary" href="#/orders/${encodeURIComponent(o.id)}">Отслеживать заказ</a><a class="btn" href="#/catalog">Продолжить покупки</a></div>
    </div>
  </div>`;
}
