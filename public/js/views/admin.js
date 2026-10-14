import { api, apiMode } from '../api.js';
import { state } from '../state.js';
import { icon, esc, rub, note, fillBar, toast, modal, closeModal, formData, statusTag } from '../ui.js';
import { CONFIG, REGIONS, DIRECTIONS, ORDER_STATUSES, WAVE_STATUSES, fmtDate, fmtRange, kg, statusTitle } from '../../shared/logic.js';
import { go } from '../app.js';

const TABS = [['', 'Дашборд'], ['waves', 'Сборные партии'], ['orders', 'Заказы'], ['products', 'Товары']];
const token = () => { try { return localStorage.getItem('sm-admin'); } catch { return null; } };

function shell(tab, title, body) {
  return `<div class="admin">
    <nav class="admin__side" aria-label="Разделы администратора">
      <a class="logo" href="#/admin"><img src="img/logo.svg" alt="" width="80" height="48"><span>СЛАДКИЙ МОСТ</span></a>
      ${TABS.map(([k, t]) => `<a href="#/admin${k ? '/' + k : ''}" class="${tab === k ? 'active' : ''}">${t}</a>`).join('')}
      <a href="#/">← На сайт</a>
      <a href="#/admin/logout" class="hide-m muted mt-24">Выйти</a>
    </nav>
    <div class="admin__main">
      <div class="row between" style="margin-bottom:20px"><b>Управление маркетплейсом</b><span class="row"><span class="tag tag--muted">${apiMode() === 'local' ? 'Демо-режим (браузер)' : 'Сервер'}</span><span class="tag tag--muted">Администратор</span></span></div>
      <p class="small muted">Панель администратора / ${title}</p>
      <h1 class="mt-8" style="margin-bottom:24px">${title}</h1>
      ${body}
    </div>
  </div>`;
}

function loginView() {
  return {
    html: `<div class="container page" style="max-width:480px"><a class="logo" href="#/" style="margin:0 auto 24px"><img src="img/logo.svg" alt="" width="80" height="48"><span>СЛАДКИЙ МОСТ</span></a>
      <div class="card"><h2>Кабинет администратора</h2><p class="muted mt-8">Управление товарами, волнами и статусами заказов.</p>
      <form id="al" class="stack mt-16"><label class="field"><span>Пароль</span><input class="input" type="password" name="pw" autocomplete="current-password"></label><p class="error-text" id="err"></p><button class="btn btn--primary btn--block">Войти</button></form>
      <p class="xs muted mt-12">Демо-пароль: <b>admin</b> (на сервере задаётся переменной ADMIN_PASSWORD).</p></div>
      <p class="mt-16" style="text-align:center"><a class="link-btn" href="#/">← Вернуться на сайт</a></p></div>`,
    mount(root) {
      root.querySelector('#al').addEventListener('submit', async (e) => {
        e.preventDefault();
        localStorage.setItem('sm-admin', e.target.pw.value);
        try {
          const r = await api('POST', '/api/admin/login');
          if (!r.ok) throw new Error('Неверный пароль');
          go('#/admin');
        } catch (ex) { localStorage.removeItem('sm-admin'); root.querySelector('#err').textContent = ex.message; }
      });
    },
  };
}

export async function view({ params }) {
  const tab = params[0] || '';
  if (tab === 'logout') { localStorage.removeItem('sm-admin'); go('#/admin'); return ''; }
  if (!token()) return loginView();
  try {
    if (tab === 'waves') return await waves();
    if (tab === 'orders') return await orders();
    if (tab === 'products') return await products();
    return await dashboard();
  } catch (e) {
    if (e.status === 401) { localStorage.removeItem('sm-admin'); return loginView(); }
    throw e;
  }
}

async function dashboard() {
  const s = await api('GET', '/api/admin/stats');
  const maxTop = Math.max(1, ...s.top.map((t) => t.qty));
  const body = `
    <div class="kpis">
      <div class="card"><span class="small muted">Заказов</span><b>${s.orders}</b></div>
      <div class="card"><span class="small muted">Оборот</span><b>${rub(s.revenue)}</b></div>
      <div class="card"><span class="small muted">Средний чек</span><b>${rub(s.avg_check)}</b></div>
      <div class="card"><span class="small muted">Комиссия платформы (15%)</span><b>${rub(s.commission_estimate)}</b></div>
    </div>
    <h2 class="mt-32" style="margin-bottom:16px">Встречная загрузка</h2>
    <div class="counter">${s.counter.map((c) => {
      const w = c.wave;
      return `<div class="card"><div class="row between"><h3 style="margin:0">${c.title}</h3>${w ? `<span class="tag">отправка ${fmtDate(w.departure)}</span>` : ''}</div>
        ${w ? `${fillBar(w.load_kg, 0, CONFIG.maxLoadKg)}
          <div class="fill-legend"><span>${kg(w.load_kg)} из ${CONFIG.maxLoadKg} · ${w.orders_count} заказ(ов)</span><span>тариф ${w.rate} ₽/кг</span></div>
          <p class="small mt-12">Сбор до ${fmtDate(w.cutoff)} · ${w.load_kg >= CONFIG.minLoadKg ? '<span class="tag tag--ok">минимум набран</span>' : `<span class="tag tag--warn">до минимума ${kg(CONFIG.minLoadKg - w.load_kg)}</span>`}</p>`
        : '<p class="muted">Нет открытой волны</p>'}
        ${c.forecast_kg ? `<p class="small muted mt-8">Прогноз объёма волны по последним партиям: ~${c.forecast_kg} кг (${Math.round(c.forecast_kg / CONFIG.maxLoadKg * 100)}%)</p>` : ''}
      </div>`;
    }).join('')}</div>
    <div class="counter mt-24">
      <div class="card"><h3>Популярные товары</h3><div class="bars">${s.top.map((t) => `<div class="bar"><span class="small">${esc(t.name)}</span><div><i style="width:${(t.qty / maxTop) * 100}%"></i></div><b class="small">${t.qty} шт.</b></div>`).join('') || '<p class="muted">Пока нет продаж</p>'}</div></div>
      <div class="card"><h3>Статусы заказов</h3>${[...ORDER_STATUSES, { id: 'cancelled', title: 'Отменён' }].map((st) => `<div class="kv"><span>${st.title}</span><b>${s.byStatus[st.id] || 0}</b></div>`).join('')}
        <div class="kv"><span>Из них подарков</span><b>${s.gifts}</b></div></div>
    </div>
    <div class="mt-24">${note('Демонстрационные данные: прошлые партии содержат условную загрузку от других покупателей.')}</div>`;
  return shell('', 'Дашборд', body);
}

async function waves() {
  const list = await api('GET', '/api/admin/waves');
  const opts = (cur) => Object.entries(WAVE_STATUSES).map(([k, t]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${t}</option>`).join('');
  const body = `
    <div class="card" style="margin-bottom:16px"><div class="grid-2">
      <label class="field"><span>Направление</span><select class="select" id="fdir"><option value="">Все направления</option>${Object.values(DIRECTIONS).map((d) => `<option value="${d.id}">${d.title}</option>`).join('')}</select></label>
      <label class="field"><span>Статус</span><select class="select" id="fst"><option value="">Все статусы</option>${opts('').replace('selected', '')}</select></label>
    </div></div>
    <div class="table-wrap"><table class="table"><thead><tr><th>Партия</th><th>Направление</th><th>Сбор до / отправка</th><th>Прибытие</th><th>Загрузка</th><th>Тариф</th><th>Заказов</th><th>Статус</th></tr></thead>
    <tbody>${list.map((w) => `<tr data-dir="${w.direction}" data-st="${w.status}">
      <td class="nowrap"><b>${w.departure.slice(5).split('-').reverse().join('.')}</b><div class="xs muted">${w.direction}</div></td>
      <td>${w.title}</td>
      <td class="nowrap">${fmtDate(w.cutoff)} / ${fmtDate(w.departure)}</td>
      <td class="nowrap">${fmtRange(w.arrivalFrom, w.arrivalTo)}${w.offSeason ? ' <span class="tag tag--warn">+7</span>' : ''}</td>
      <td style="min-width:160px">${fillBar(w.load_kg, 0, CONFIG.maxLoadKg)}<span class="xs ${w.load_kg < CONFIG.minLoadKg ? 'accent' : 'muted'}">${kg(w.load_kg)} / ${CONFIG.maxLoadKg}</span></td>
      <td class="nowrap">${w.final_rate ? `<b>${w.final_rate}</b> итог` : `${w.rate}`} ₽/кг</td>
      <td>${w.orders_count ? `<a class="accent" href="#/admin/orders?wave=${encodeURIComponent(w.id)}">${w.orders_count}</a>` : 0}</td>
      <td><select class="select" data-wave="${w.id}">${opts(w.status)}</select></td>
    </tr>`).join('')}</tbody></table></div>
    <div class="grid-2 mt-24" style="gap:16px">
      ${note(`«Сбор закрыт» — фиксирует загрузку и пересчитывает доставку всех заказов волны по итоговому тарифу (цена может только снизиться). Заказы → «В сборке».`)}
      ${note(`«Перенесена» — если партия не набрала ${CONFIG.minLoadKg} кг: заказы переносятся в следующую волну направления. «В пути»/«Прибыла» меняют статусы заказов автоматически.`)}
    </div>`;
  const out = shell('waves', 'Сборные партии', body);
  return {
    html: out,
    mount(root) {
      const filter = () => {
        const d = root.querySelector('#fdir').value, st = root.querySelector('#fst').value;
        root.querySelectorAll('tbody tr').forEach((tr) => { tr.hidden = (d && tr.dataset.dir !== d) || (st && tr.dataset.st !== st); });
      };
      root.querySelector('#fdir').onchange = filter;
      root.querySelector('#fst').onchange = filter;
      root.querySelectorAll('[data-wave]').forEach((sel) => sel.addEventListener('change', async () => {
        try { await api('POST', `/api/admin/waves/${encodeURIComponent(sel.dataset.wave)}/status`, { status: sel.value }); toast(`Партия: ${WAVE_STATUSES[sel.value]}`); go(location.hash); }
        catch (e) { toast(e.message); }
      }));
    },
  };
}

async function orders() {
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  const list = await api('GET', `/api/admin/orders${q.toString() ? '?' + q : ''}`);
  const opts = (cur) => [...ORDER_STATUSES, { id: 'cancelled', title: 'Отменён' }].map((s) => `<option value="${s.id}" ${s.id === cur ? 'selected' : ''}>${s.title}</option>`).join('');
  const body = `
    <div class="chips" style="margin-bottom:16px"><a class="chip ${!q.get('status') && !q.get('wave') ? 'active' : ''}" href="#/admin/orders">Все</a>
      ${ORDER_STATUSES.map((s) => `<a class="chip ${q.get('status') === s.id ? 'active' : ''}" href="#/admin/orders?status=${s.id}">${s.title}</a>`).join('')}
      ${q.get('wave') ? `<span class="chip active">Волна ${esc(q.get('wave'))}</span>` : ''}</div>
    <div class="table-wrap"><table class="table"><thead><tr><th>№</th><th>Дата</th><th>Покупатель → получатель</th><th>Направление / волна</th><th>Тип</th><th>Сумма</th><th>Статус</th></tr></thead>
    <tbody>${list.map((o) => `<tr>
      <td><button class="link-btn accent" data-open="${esc(o.id)}" style="color:var(--accent)">${esc(o.id)}</button></td>
      <td class="nowrap">${fmtDate(o.created)}</td>
      <td>${esc(o.customer.name)}<div class="xs muted">→ ${esc(o.recipient.name)}, ${esc(o.recipient.city)}</div></td>
      <td>${DIRECTIONS[o.direction].title}<div class="xs muted">отправка ${o.wave ? fmtDate(o.wave.departure) : '—'}</div></td>
      <td>${o.gift ? `<span class="tag">${icon('gift')}подарок</span>` : o.kind === 'b2b' ? '<span class="tag tag--muted">B2B</span>' : 'для себя'}</td>
      <td class="nowrap"><b>${rub(o.total_rub)}</b><div class="xs muted">${kg(o.weight_kg)} · дост. ${rub(o.delivery_rub)}</div></td>
      <td><select class="select" data-order="${esc(o.id)}">${opts(o.status)}</select></td>
    </tr>`).join('') || '<tr><td colspan="7" class="muted">Заказов нет</td></tr>'}</tbody></table></div>`;
  return {
    html: shell('orders', 'Заказы', body),
    mount(root) {
      root.querySelectorAll('[data-order]').forEach((sel) => sel.addEventListener('change', async () => {
        try { await api('POST', `/api/admin/orders/${encodeURIComponent(sel.dataset.order)}/status`, { status: sel.value }); toast(`${sel.dataset.order}: ${statusTitle(sel.value)}`); }
        catch (e) { toast(e.message); }
      }));
      root.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => {
        const o = list.find((x) => x.id === b.dataset.open);
        modal(`<div class="row between"><h2>Заказ ${esc(o.id)}</h2><button class="icon-btn" data-action="close-modal" aria-label="Закрыть">${icon('x')}</button></div>
          <p class="small muted mt-8">${fmtDate(o.created, true)} · ${DIRECTIONS[o.direction].title} · ${statusTag(o.status, o.status_title)}</p>
          <div class="grid-2 mt-16"><div><b class="small">Покупатель</b><p class="small">${esc(o.customer.name)}<br>${esc(o.customer.phone)}${o.company ? '<br>' + esc(o.company) : ''}</p></div>
          <div><b class="small">Получатель</b><p class="small">${esc(o.recipient.name)}<br>${esc(o.recipient.phone)}<br>${esc(o.recipient.address)}</p></div></div>
          <hr class="divider">${o.items.map((i) => `<div class="kv"><span>${esc(i.name)} × ${i.qty}</span><b>${rub(i.price_rub * i.qty)}</b></div>`).join('')}
          <div class="kv"><span>Доставка ${kg(o.weight_kg)} × ${o.rate_rub} ₽</span><b>${rub(o.delivery_rub)}</b></div>
          ${o.thermo_rub ? `<div class="kv"><span>Термоупаковка</span><b>${rub(o.thermo_rub)}</b></div>` : ''}
          ${o.gift_rub ? `<div class="kv"><span>Подарочная коробка</span><b>${rub(o.gift_rub)}</b></div>` : ''}
          ${o.receive_rub ? `<div class="kv"><span>Курьер</span><b>${rub(o.receive_rub)}</b></div>` : ''}
          <div class="total mt-8"><span>Итого</span><b>${rub(o.total_rub)}</b></div>
          ${o.refund_rub ? `<p class="small accent mt-8">К возврату после пересчёта: ${rub(o.refund_rub)}</p>` : ''}
          ${o.gift ? `<div class="postcard mt-16"><p class="postcard__msg">${esc(o.gift.message)}</p><p class="postcard__sign">${esc(o.gift.signature)}</p>${o.gift.surprise ? '<p class="xs muted mt-8">Сюрприз — связаться с отправителем</p>' : ''}</div>` : ''}`);
      }));
    },
  };
}

async function products() {
  const list = await api('GET', '/api/admin/products');
  const body = `
    <div class="row between" style="margin-bottom:16px"><p class="small muted">${list.filter((p) => p.active).length} активных · ${list.length} всего</p><button class="btn btn--primary" id="new">${icon('box')} Добавить товар</button></div>
    <div class="table-wrap"><table class="table"><thead><tr><th></th><th>Артикул</th><th>Название</th><th>Регион</th><th>Категория</th><th>Масса</th><th>Цена</th><th>Термо</th><th></th></tr></thead>
    <tbody>${list.map((p) => `<tr style="${p.active ? '' : 'opacity:.5'}">
      <td><img src="${esc(p.photo)}" alt="" style="width:48px;height:42px;object-fit:cover;border-radius:6px"></td>
      <td class="small">${p.id}</td><td><b class="small">${esc(p.name)}</b><div class="xs muted">${esc(p.manufacturer)}</div></td>
      <td>${REGIONS[p.region].name}</td><td class="small">${esc(p.category)}</td><td class="nowrap">${p.weight_g} г</td><td class="nowrap">${rub(p.price_rub)}</td>
      <td>${p.temp_sensitive ? '<span class="tag tag--warn">да</span>' : 'нет'}</td>
      <td class="nowrap"><button class="btn btn--sm" data-edit="${p.id}">Изменить</button> ${p.active ? `<button class="btn btn--sm btn--ghost" data-hide="${p.id}">Скрыть</button>` : `<button class="btn btn--sm btn--ghost" data-show="${p.id}">Вернуть</button>`}</td>
    </tr>`).join('')}</tbody></table></div>`;
  const photos = ['zephyr', 'truffles', 'cookies', 'marmalade', 'wafers', 'cedar', 'gift', 'yakutia', 'hero'];
  const editor = (p = {}) => {
    const m = modal(`<div class="row between"><h2>${p.id ? 'Изменить товар' : 'Новый товар'}</h2><button class="icon-btn" data-action="close-modal" aria-label="Закрыть">${icon('x')}</button></div>
      <form id="pf" class="stack mt-16">
        <label class="field"><span>Название *</span><input class="input" name="name" value="${esc(p.name || '')}" required></label>
        <div class="grid-2"><label class="field"><span>Регион</span><select class="select" name="region">${Object.values(REGIONS).map((r) => `<option value="${r.id}" ${p.region === r.id ? 'selected' : ''}>${r.name}</option>`).join('')}</select></label>
          <label class="field"><span>Категория</span><select class="select" name="category">${state.meta.categories.map((c) => `<option ${p.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label></div>
        <label class="field"><span>Производитель</span><input class="input" name="manufacturer" value="${esc(p.manufacturer || '')}"></label>
        <div class="grid-2"><label class="field"><span>Масса нетто, г *</span><input class="input" name="weight_g" type="number" min="1" value="${p.weight_g || ''}" required></label>
          <label class="field"><span>Цена, ₽ *</span><input class="input" name="price_rub" type="number" min="1" value="${p.price_rub || ''}" required></label></div>
        <div class="grid-2"><label class="field"><span>Срок годности, сут</span><input class="input" name="shelf_life_days" type="number" min="1" value="${p.shelf_life_days || 30}"></label>
          <label class="field"><span>Фото</span><select class="select" name="photo">${photos.map((f) => `<option value="img/${f}.jpg" ${p.photo === `img/${f}.jpg` ? 'selected' : ''}>${f}.jpg</option>`).join('')}</select></label></div>
        <label class="field"><span>Метка</span><input class="input" name="tag" value="${esc(p.tag || '')}" placeholder="Например: Хит"></label>
        <label class="field"><span>Описание</span><textarea class="textarea" name="description">${esc(p.description || '')}</textarea></label>
        <label class="field"><span>Состав</span><textarea class="textarea" name="composition">${esc(p.composition || '')}</textarea></label>
        <label class="check"><input type="checkbox" name="temp_sensitive" ${p.temp_sensitive ? 'checked' : ''}> Чувствителен к температуре (шоколад)</label>
        <p class="error-text" id="perr"></p>
        <button class="btn btn--primary">Сохранить</button>
      </form>`);
    m.querySelector('#pf').addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = formData(e.target);
      try {
        const r = await api('POST', '/api/admin/products', { ...v, id: p.id, weight_g: +v.weight_g, price_rub: +v.price_rub, shelf_life_days: +v.shelf_life_days });
        const i = state.products.findIndex((x) => x.id === r.product.id);
        if (i >= 0) state.products[i] = r.product; else state.products.push(r.product);
        closeModal(); toast('Товар сохранён'); go(location.hash);
      } catch (ex) { m.querySelector('#perr').textContent = ex.message; }
    });
  };
  return {
    html: shell('products', 'Товары', body),
    mount(root) {
      root.querySelector('#new').onclick = () => editor();
      root.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => editor(list.find((p) => p.id === b.dataset.edit))));
      const setActive = async (id, active) => {
        const r = active ? await api('POST', '/api/admin/products', { id, active: true }) : (await api('DELETE', `/api/admin/products/${id}`));
        const i = state.products.findIndex((x) => x.id === id);
        if (i >= 0) state.products[i] = r.product;
        toast(active ? 'Товар снова в каталоге' : 'Товар скрыт из каталога'); go(location.hash);
      };
      root.querySelectorAll('[data-hide]').forEach((b) => b.addEventListener('click', () => setActive(b.dataset.hide, false)));
      root.querySelectorAll('[data-show]').forEach((b) => b.addEventListener('click', () => setActive(b.dataset.show, true)));
    },
  };
}
