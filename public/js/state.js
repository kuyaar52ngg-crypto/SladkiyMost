// Клиентское состояние: корзина, избранное, профиль, черновик оформления.
const KEY = 'sm-state-v1';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
const saved = load();

export const state = {
  cart: saved.cart || [],          // [{id, qty}]
  favs: saved.favs || [],          // [id]
  profile: saved.profile || null,  // {name, phone}
  draft: saved.draft || {},        // данные оформления заказа
  products: [],                    // кэш каталога
  meta: null,
};

export function persist() {
  const { cart, favs, profile, draft } = state;
  try { localStorage.setItem(KEY, JSON.stringify({ cart, favs, profile, draft })); } catch { /* приватный режим */ }
}

export const productById = (id) => state.products.find((p) => p.id === id);

export function cartItems(origin) {
  return state.cart
    .map((i) => ({ ...productById(i.id), qty: i.qty }))
    .filter((i) => i.id && (!origin || i.region === origin));
}
export const cartCount = () => state.cart.reduce((s, i) => s + i.qty, 0);

export function addToCart(id, qty = 1) {
  const it = state.cart.find((i) => i.id === id);
  if (it) it.qty = Math.min(50, it.qty + qty); else state.cart.push({ id, qty });
  persist();
}
export function setQty(id, qty) {
  if (qty <= 0) state.cart = state.cart.filter((i) => i.id !== id);
  else { const it = state.cart.find((i) => i.id === id); if (it) it.qty = Math.min(50, qty); }
  persist();
}
export function clearOrigin(origin) {
  state.cart = state.cart.filter((i) => productById(i.id)?.region !== origin);
  persist();
}

export const isFav = (id) => state.favs.includes(id);
export function toggleFav(id) {
  state.favs = isFav(id) ? state.favs.filter((x) => x !== id) : [...state.favs, id];
  persist();
  return isFav(id);
}

export function setDraft(patch) { state.draft = { ...state.draft, ...patch }; persist(); }
export function setProfile(p) { state.profile = p; persist(); }
