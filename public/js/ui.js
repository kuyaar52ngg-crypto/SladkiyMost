import { REGIONS, rub } from '../shared/logic.js';
import { state, isFav } from './state.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const P = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  bag: '<path d="M6 7h12l1 14H5L6 7Z"/><path d="M9 10V6a3 3 0 0 1 6 0v4"/>',
  heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/>',
  pin: '<path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
  box: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>',
  gift: '<rect x="3" y="8" width="18" height="5" rx="1"/><path d="M5 13v8h14v-8M12 8v13M12 8S10.5 3 8 4.2 9.5 8 12 8Zm0 0s1.5-5 4-3.8S14.5 8 12 8Z"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
  truck: '<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  thermo: '<path d="M10 14V5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0Z"/><path d="M12 10v6"/>',
  snow: '<path d="M12 2v20M4 6l16 12M20 6 4 18"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  bell: '<path d="M6 9a6 6 0 0 1 12 0c0 6 3 7 3 7H3s3-1 3-7M10 20a2 2 0 0 0 4 0"/>',
  logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
};
export const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[name] || ''}</svg>`;

export { rub };
export const regionName = (id) => REGIONS[id]?.name || id;

export function productCard(p) {
  const fav = isFav(p.id);
  return `<article class="product">
    <div class="product__img">
      <a href="#/product/${p.id}" aria-label="${esc(p.name)}"><img src="${esc(p.photo)}" alt="${esc(p.name)}" loading="lazy"></a>
      ${p.tag ? `<span class="product__label">${esc(p.tag)}</span>` : ''}
      <button class="fav-btn ${fav ? 'on' : ''}" data-action="fav" data-id="${p.id}" aria-label="${fav ? 'Убрать из избранного' : 'В избранное'}" aria-pressed="${fav}">${icon('heart')}</button>
    </div>
    <div class="product__meta">${regionName(p.region)} · ${p.weight_g} г ${p.temp_sensitive ? `<span class="tag tag--warn" title="Чувствителен к температуре">${icon('thermo')}шоколад</span>` : ''}</div>
    <a class="product__name" href="#/product/${p.id}">${esc(p.name)}</a>
    <div class="product__foot">
      <span class="price">${rub(p.price_rub)}</span>
      <button class="btn btn--sm" data-action="add" data-id="${p.id}">${inCart(p.id) ? `${icon('check')} В корзине` : 'В корзину'}</button>
    </div>
  </article>`;
}

function inCart(id) { return state.cart.some((i) => i.id === id); }

export function note(text, kind = '') {
  return `<div class="note ${kind ? 'note--' + kind : ''}">${icon(kind === 'ok' ? 'check' : kind === 'warn' ? 'thermo' : 'info')}<div>${text}</div></div>`;
}

export function steps(current) {
  const names = ['Корзина', 'Отправка', 'Расчёт доставки', 'Оформление'];
  return `<ol class="steps" style="list-style:none;padding:0">${names.map((n, i) => {
    const cls = i + 1 < current ? 'done' : i + 1 === current ? 'current' : '';
    return `<li class="step ${cls}"><i>${i + 1 < current ? icon('check') : i + 1}</i><span>${n}</span></li>`;
  }).join('')}</ol>`;
}

export function crumbs(list) {
  return `<nav class="crumbs" aria-label="Хлебные крошки">${list.map(([t, h]) => h ? `<a href="${h}">${esc(t)}</a>` : `<span>${esc(t)}</span>`).join(' / ')}</nav>`;
}

let toastTimer;
export function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}

export function modal(html) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal" data-action="modal-bg"><div class="modal__box" role="dialog" aria-modal="true">${html}</div></div>`;
  return root.firstElementChild;
}
export function closeModal() { document.getElementById('modal-root').innerHTML = ''; }

export function fillBar(load, add, max) {
  const cur = Math.min(100, (load / max) * 100);
  const plus = Math.min(100 - cur, (add / max) * 100);
  return `<div class="fillbar" role="img" aria-label="Заполнено ${Math.round(cur)}%">
    <div class="fillbar__cur" style="width:${cur}%"></div>
    ${add ? `<div class="fillbar__add" style="left:${cur}%;width:${plus}%"></div>` : ''}
    <div class="fillbar__mark" style="left:50%"></div><div class="fillbar__mark" style="left:80%"></div>
  </div>`;
}

export function statusTag(status, title) {
  const kind = { received: 'ok', cancelled: 'muted', transit: '', pickup: 'ok', accepted: 'warn', assembling: 'warn' }[status];
  return `<span class="tag ${kind ? 'tag--' + kind : ''}">${esc(title)}</span>`;
}

export function formData(form) {
  const o = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') o[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; }
    else o[el.name] = el.value.trim();
  }
  return o;
}

export const plural = (n, a, b, c) => { const m = n % 10, mm = n % 100; return m === 1 && mm !== 11 ? a : m >= 2 && m <= 4 && (mm < 10 || mm >= 20) ? b : c; };
