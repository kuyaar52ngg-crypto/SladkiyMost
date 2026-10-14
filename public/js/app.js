import { api, apiMode } from './api.js';
import { state, cartCount, addToCart, toggleFav, persist } from './state.js';
import { icon, toast, closeModal, esc } from './ui.js';
import * as shop from './views/shop.js';
import * as checkout from './views/checkout.js';
import * as account from './views/account.js';
import * as admin from './views/admin.js';

const routes = [
  [/^$/, shop.home],
  [/^catalog$/, shop.catalog],
  [/^product\/([\w-]+)$/, shop.product],
  [/^favorites$/, shop.favorites],
  [/^gift$/, shop.gift],
  [/^delivery$/, shop.delivery],
  [/^about$/, shop.about],
  [/^cart$/, checkout.cart],
  [/^checkout\/wave$/, checkout.wave],
  [/^checkout\/calc$/, checkout.calc],
  [/^checkout\/form$/, checkout.form],
  [/^success\/(.+)$/, checkout.success],
  [/^orders$/, account.orders],
  [/^orders\/(.+)$/, account.orderDetail],
  [/^login$/, account.login],
  [/^admin(?:\/(\w+))?$/, admin.view],
];

export function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  return { path: decodeURIComponent(path.replace(/\/$/, '')), query: Object.fromEntries(new URLSearchParams(qs || '')) };
}

export function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }

function header() {
  const n = cartCount();
  return `<div class="container header__inner">
    <a class="logo" href="#/" aria-label="Сладкий мост — на главную"><img src="img/logo.svg" alt="" width="80" height="48"><span>СЛАДКИЙ МОСТ</span></a>
    <nav class="nav" aria-label="Основная навигация">
      <a href="#/catalog" data-nav="catalog">Каталог</a>
      <a href="#/delivery" data-nav="delivery">Сборная доставка</a>
      <a href="#/gift" data-nav="gift">Подарки</a>
      <a href="#/about" data-nav="about">О нас</a>
    </nav>
    <div class="header__actions">
      <a href="#/catalog?focus=1" aria-label="Поиск">${icon('search')}</a>
      <a href="#/orders" class="hide-m">${icon('user')}<span>Мои заказы</span></a>
      <a href="#/cart" aria-label="Корзина: ${n}">${icon('bag')}<span class="badge-count" id="cart-count">${n || ''}</span></a>
    </div>
  </div>`;
}

function footer() {
  return `<div class="container">
    <div class="footer__grid">
      <div><a class="logo" href="#/"><img src="img/logo.svg" alt="" width="80" height="48"><span>СЛАДКИЙ МОСТ</span></a>
        <p class="small muted mt-12">Сладости, которые делают расстояния меньше.</p></div>
      <div><h4>Выбрать сладости</h4><ul><li><a href="#/catalog?region=YKT">Сладости Якутии</a></li><li><a href="#/catalog?region=DNR">Сладости Донбасса</a></li><li><a href="#/catalog?cat=${encodeURIComponent('Подарочные наборы')}">Подарочные наборы</a></li></ul></div>
      <div><h4>Покупателю</h4><ul><li><a href="#/delivery">Как работает доставка</a></li><li><a href="#/delivery#rules">Оплата и получение</a></li><li><a href="#/orders">Мои заказы</a></li></ul></div>
      <div><h4>Будем на связи</h4><ul><li><a href="#/about#contacts">Задать вопрос</a></li><li><a href="#/admin">Кабинет администратора</a></li><li><a href="#/about#business">Бизнес-модель</a></li></ul></div>
    </div>
    <div class="footer__bottom"><span>© 2026 «Сладкий мост»</span><span>Демонстрационный MVP · хакатон PEAK IT</span><span>Цены и партии — условные</span></div>
  </div>`;
}

function tabbar(path) {
  const n = cartCount();
  const a = (href, ic, label, key, extra = '') => `<a href="${href}" class="${path.startsWith(key) && (key || !path) ? 'active' : ''}">${icon(ic)}${label}${extra}</a>`;
  return a('#/catalog', 'grid', 'Каталог', 'catalog')
    + a('#/favorites', 'heart', 'Избранное', 'favorites')
    + a('#/cart', 'bag', 'Корзина', 'cart', n ? `<span class="dot">${n}</span>` : '')
    + a('#/orders', 'user', 'Кабинет', 'orders');
}

export function refreshChrome() {
  const { path } = parseHash();
  document.getElementById('header').innerHTML = header();
  document.getElementById('tabbar').innerHTML = tabbar(path);
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', path.startsWith(a.dataset.nav)));
}

let renderId = 0;
export async function render() {
  const id = ++renderId;
  const { path, query } = parseHash();
  closeModal();
  const isAdmin = path.startsWith('admin');
  document.getElementById('site').hidden = isAdmin;
  document.getElementById('admin-root').hidden = !isAdmin;
  const target = isAdmin ? document.getElementById('admin-root') : document.getElementById('app');
  if (!isAdmin) refreshChrome();
  let match = null, fn = shop.notFound;
  for (const [re, f] of routes) { match = path.match(re); if (match) { fn = f; break; } }
  try {
    const out = await fn({ params: match ? match.slice(1) : [], query, target });
    if (id !== renderId) return;
    target.innerHTML = typeof out === 'string' ? out : out.html;
    if (out.mount) out.mount(target);
  } catch (e) {
    console.error(e);
    target.innerHTML = `<div class="container page"><div class="empty"><h3>Что-то пошло не так</h3><p class="muted">${esc(e.message)}</p><a class="btn mt-16" href="#/">На главную</a></div></div>`;
  }
  if (!location.hash.includes('#rules') && !location.hash.includes('#business')) window.scrollTo(0, 0);
  const anchor = location.hash.match(/#(rules|business|contacts)$/);
  if (anchor) document.getElementById(anchor[1])?.scrollIntoView();
}

// Делегированные действия по всему сайту
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const { action, id } = el.dataset;
  if (action === 'add') {
    addToCart(id);
    toast('Добавлено в корзину');
    el.innerHTML = `${icon('check')} В корзине`;
    refreshChrome();
  } else if (action === 'fav') {
    const on = toggleFav(id);
    el.classList.toggle('on', on);
    el.setAttribute('aria-pressed', on);
    toast(on ? 'Добавлено в избранное' : 'Убрано из избранного');
  } else if (action === 'modal-bg' && e.target === el) {
    closeModal();
  } else if (action === 'close-modal') {
    closeModal();
  }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

window.addEventListener('hashchange', render);

(async function init() {
  document.getElementById('footer').innerHTML = footer();
  try {
    const [meta, products] = await Promise.all([api('GET', '/api/meta'), api('GET', '/api/products?includeInactive=1')]);
    state.meta = meta;
    state.products = products;
    // убираем из корзины товары, которых больше нет
    state.cart = state.cart.filter((i) => products.some((p) => p.id === i.id && p.active));
    persist();
  } catch (e) {
    document.getElementById('app').innerHTML = `<div class="container page"><div class="empty"><h3>Не удалось загрузить каталог</h3><p class="muted">${esc(e.message)}</p></div></div>`;
    return;
  }
  if (apiMode() === 'local') {
    const b = document.createElement('span');
    b.className = 'tag tag--muted demo-badge';
    b.title = 'Сервер недоступен: данные хранятся в браузере';
    b.textContent = 'Демо-режим';
    document.body.appendChild(b);
  }
  render();
})();
