import { api } from '../api.js';
import { state, productById, addToCart, setDraft } from '../state.js';
import { icon, esc, rub, productCard, note, crumbs, fillBar, toast, regionName, plural } from '../ui.js';
import { CONFIG, REGIONS, DIRECTIONS, fmtDate, fmtRange, kg, quote, seasonInfo, tariffForLoad } from '../../shared/logic.js';
import { go, refreshChrome } from '../app.js';

const active = () => state.products.filter((p) => p.active);
const pick = (...ids) => ids.map(productById).filter(Boolean);

export function notFound() {
  return `<div class="container page"><div class="empty"><h3>Страница не найдена</h3><p class="muted">Возможно, ссылка устарела.</p><a class="btn btn--primary mt-16" href="#/">На главную</a></div></div>`;
}

function waveMini(w) {
  return `<div class="card">
    <div class="row between"><span class="tag">${w.title}</span><span class="small muted">осталось ${w.days_left} ${plural(w.days_left, 'день', 'дня', 'дней')}</span></div>
    <h3 class="mt-12" style="margin-bottom:6px">Сбор до ${fmtDate(w.cutoff)} · отправка ${fmtDate(w.departure)}</h3>
    <p class="small muted">Получение, ориентир: ${fmtRange(w.arrivalFrom, w.arrivalTo)}${w.offSeason ? ' (межсезонье +7 дней)' : ''}</p>
    ${fillBar(w.load_kg, 0, CONFIG.maxLoadKg)}
    <div class="fill-legend"><span>Заполнено ${kg(w.load_kg)} из ${CONFIG.maxLoadKg}</span><span>Сейчас <b class="accent">${w.rate} ₽/кг</b>${w.discount ? ` (−${w.discount}%)` : ''}</span></div>
  </div>`;
}

// ---------------- Главная ----------------
export async function home() {
  const waves = await api('GET', '/api/waves?onlyOpen=1');
  const next = Object.keys(DIRECTIONS).map((d) => waves.find((w) => w.direction === d)).filter(Boolean);
  const popular = pick('YKT-001', 'DNR-001', 'DNR-002', 'YKT-003');
  const sample = next.slice().sort((a, b) => a.rate - b.rate)[0];
  const q = sample ? quote({ items: [{ weight_g: 1000, qty: 1, price_rub: 0 }], wave: sample }) : null;
  return `
  <section class="container hero">
    <div>
      <p class="overline">Якутия и Донбасс · с любовью к родному</p>
      <h1>Вкус родного края — ближе, чем кажется</h1>
      <p class="lead">Любимые сладости из Якутии и Донбасса. Объединяем заказы в сборные отправки, чтобы доставка была выгоднее.</p>
      <div class="row mt-24">
        <a class="btn btn--primary" href="#/catalog">Выбрать сладости ${icon('bag')}</a>
        <a class="btn" href="#/delivery">Как работает доставка</a>
      </div>
      <p class="small muted mt-16">Для себя, к семейному чаепитию и в подарок близким.</p>
    </div>
    <div class="hero__img"><img src="img/hero.jpg" alt="Зефир, трюфели и печенье к чаю" width="596" height="520">
      <div class="hero__caption"><p class="xs overline" style="color:var(--muted)">Два региона — один сладкий мост</p><p class="mt-8" style="font-weight:600">Знакомые вкусы. Новые встречи.</p></div>
    </div>
  </section>
  <section class="features"><div class="container features__inner">
    <div class="feature"><span class="feature__icon">${icon('pin')}</span><div><b>Сладости двух регионов</b><span class="small muted">Якутия и Донбасс в одном каталоге</span></div></div>
    <div class="feature"><span class="feature__icon">${icon('box')}</span><div><b>Сборная отправка</b><span class="small muted">Общие расходы — между заказами</span></div></div>
    <div class="feature"><span class="feature__icon">${icon('gift')}</span><div><b>Подарки со смыслом</b><span class="small muted">Открытка и тёплые слова получателю</span></div></div>
  </div></section>

  <section class="section"><div class="container">
    <div class="section-head"><h2>Два края. Столько любимых вкусов.</h2></div>
    <div class="regions">
      <a class="region-card" href="#/catalog?region=YKT">
        <div class="region-card__img"><img src="img/yakutia.jpg" alt="Зефир и мармелад с северными ягодами" loading="lazy"></div>
        <div class="region-card__body"><div><h3>Сладости Якутии</h3><p class="small muted">Ягодная нежность и характер Севера</p></div><span class="btn btn--sm">Смотреть ${icon('arrow')}</span></div>
        <p class="small muted mt-8">Зефир, мармелад и конфеты с орехами</p>
      </a>
      <a class="region-card" href="#/catalog?region=DNR">
        <div class="region-card__img"><div class="region-card__mosaic"><img src="img/truffles.jpg" alt="" loading="lazy"><img src="img/cookies.jpg" alt="" loading="lazy"><img src="img/wafers.jpg" alt="" loading="lazy"></div></div>
        <div class="region-card__body"><div><h3>Сладости Донбасса</h3><p class="small muted">Тёплые традиции к вашему столу</p></div><span class="btn btn--sm">Смотреть ${icon('arrow')}</span></div>
        <p class="small muted mt-8">Шоколад, печенье и хрустящие вафли</p>
      </a>
    </div>
  </div></section>

  <section class="section" style="padding-top:0"><div class="container">
    <div class="section-head"><h2>Начните с чего-нибудь любимого</h2><a class="btn btn--sm" href="#/catalog">Весь каталог ${icon('arrow')}</a></div>
    <div class="products">${popular.map(productCard).join('')}</div>
  </div></section>

  <section class="section section--soft"><div class="container">
    <div class="how">
      <div>
        <p class="overline">Ближе друг к другу</p>
        <h2 class="mt-12">Заказывать вместе — выгоднее</h2>
        <p class="muted mt-16">Объединяем заказы в одном направлении в «волны». Общие расходы на перевозку распределяются между участниками: чем больше заполнена партия, тем ниже тариф за килограмм.</p>
        <a class="btn mt-24" href="#/delivery">Как работает доставка ${icon('arrow')}</a>
      </div>
      <ol class="how-steps">
        <li><span class="num">01</span><div><b>Выберите сладости</b><span class="small muted">Добавьте любимые вкусы в корзину — каталог Якутии или Донбасса.</span></div></li>
        <li><span class="num">02</span><div><b>Присоединитесь к волне</b><span class="small muted">Отправки — раз в ${CONFIG.waveIntervalDays} дней в каждом направлении, приём закрывается за ${CONFIG.cutoffDaysBefore} дня.</span></div></li>
        <li><span class="num">03</span><div><b>Получите дешевле</b><span class="small muted">Партия заполнена более чем на 50% — тариф −20%, более 80% — −35%. Цена может только снизиться.</span></div></li>
      </ol>
    </div>
    <div class="counter mt-32">${next.map(waveMini).join('')}</div>
    ${q ? `<div class="card mt-16 wave-promo">
      <div><span class="tag">Пример расчёта</span><h3 class="mt-12" style="margin-bottom:4px">${sample.title}</h3><p class="small muted">Сбор до ${fmtDate(sample.cutoff)} · отправка ${fmtDate(sample.departure)}</p></div>
      <div><p class="small muted">Для посылки 1 кг нетто (${kg(q.weightKg)} с упаковкой)</p><p class="price mt-8">${rub(q.delivery)} <span class="small muted" style="font-weight:400">вместо ${rub(q.baseDelivery)} при базовом тарифе</span></p></div>
      <a class="btn btn--primary" href="#/catalog">Выбрать сладости</a>
    </div>` : ''}
  </div></section>

  <section class="section"><div class="container">
    <div class="split">
      <img src="img/hero.jpg" alt="Чаепитие со сладостями" loading="lazy" style="object-position:30% 50%">
      <div><p class="overline">О Сладком мосте</p><h2 class="mt-12">У каждого вкуса есть место, которое мы любим</h2>
        <p class="muted mt-16">«Сладкий мост» соединяет Якутию и Донбасс через простые радости: любимую сладость, несложное чаепитие и подарок человеку, который далеко.</p>
        <p class="small mt-12">Два региона в одной посылке — и чуть больше близости в каждом дне.</p></div>
    </div>
    <div class="gift-block mt-32">
      <div class="gift-block__text"><p class="overline">Тепло в каждой детали</p><h2>Подарок, который преодолевает расстояния</h2>
        <p class="muted">Выберите сладости, добавьте открытку со своими словами и укажите получателя в другом регионе. Пусть близкие почувствуют вашу заботу.</p>
        <a class="btn btn--primary" href="#/gift">Собрать подарок ${icon('gift')}</a></div>
      <img src="img/gift.jpg" alt="Подарочная коробка со сладостями" loading="lazy">
    </div>
  </div></section>

  <section class="section" style="padding-top:0"><div class="container">
    <div class="how">
      <div><h2>Всё, что хочется уточнить</h2><p class="muted mt-12">Поможем разобраться в сборной доставке и выборе сладостей.</p></div>
      <div class="faq">
        <details open><summary>Как делится стоимость доставки?</summary><p>Тариф за килограмм зависит от заполнения партии: ${CONFIG.baseTariff} ₽/кг, при заполнении более 50% — −20%, более 80% — −35%. Ваша доля = вес заказа × тариф. При закрытии сбора пересчитываем по фактической загрузке и возвращаем разницу, если стало дешевле.</p></details>
        <details><summary>Можно заказать из двух регионов?</summary><p>Да, корзина общая. Но в одну отправку входят сладости одного региона: они едут волной в регион получателя. Оформите две отправки — по одной на каждое направление.</p></details>
        <details><summary>Что с шоколадом зимой и летом?</summary><p>В декабре–феврале и июне–августе для шоколадных изделий обязательна термоупаковка (${CONFIG.thermoPrice} ₽ за заказ). В мае и ноябре — межсезонье на Лене, срок доставки +7 дней.</p></details>
        <details><summary>Когда получатель узнает о подарке?</summary><p>Можно отметить «сюрприз» — тогда мы свяжемся с вами перед вручением, а получателю напишем только о прибытии на пункт выдачи.</p></details>
      </div>
    </div>
    <div class="cta mt-32"><h2>Пусть любимый вкус будет рядом</h2><p class="muted">Начните с маленькой сладости — для себя или для тех, кого любите.</p><a class="btn btn--primary mt-24" href="#/catalog">Выбрать сладости ${icon('bag')}</a></div>
  </div></section>`;
}

// ---------------- Каталог ----------------
export function catalog({ query }) {
  const cats = state.meta.categories;
  const f = {
    region: query.region ? query.region.split(',') : [],
    cat: query.cat ? query.cat.split(',') : [],
    q: query.q || '', min: query.min || '', max: query.max || '', sort: query.sort || '',
  };
  const all = active();
  const prices = all.map((p) => p.price_rub);
  const giftMode = state.draft.gift && state.draft.origin;
  const tab = (label, params, on) => `<a class="chip ${on ? 'active' : ''}" href="#/catalog${params}">${label}</a>`;
  const isAll = !f.region.length && !f.cat.length;
  const html = `<div class="container page">
    ${crumbs([['Главная', '#/'], ['Каталог сладостей']])}
    <div class="page-head"><h1>Каталог сладостей</h1><p>Вкусы Якутии и Донбасса — выбирайте своё маленькое удовольствие.</p></div>
    ${giftMode ? `<div class="mt-16" style="margin-bottom:20px">${note(`Собираете подарок получателю в <b>${REGIONS[state.draft.origin === 'YKT' ? 'DNR' : 'YKT'].name}</b>: показываем сладости ${REGIONS[state.draft.origin].gen}. <a class="accent" href="#/cart">Перейти в корзину →</a>`)}</div>` : ''}
    <div class="chips" style="margin-bottom:28px">
      ${tab('Все сладости', '', isAll)}
      ${tab('Сладости Якутии', '?region=YKT', f.region.join() === 'YKT' && !f.cat.length)}
      ${tab('Сладости Донбасса', '?region=DNR', f.region.join() === 'DNR' && !f.cat.length)}
      ${tab('Подарочные наборы', '?cat=' + encodeURIComponent('Подарочные наборы'), f.cat.join() === 'Подарочные наборы' && !f.region.length)}
    </div>
    <div class="catalog">
      <form class="filters" id="filters">
        <h3>Фильтры</h3>
        <fieldset><legend>Регион</legend>
          ${Object.values(REGIONS).map((r) => `<label class="check"><input type="checkbox" name="region" value="${r.id}" ${f.region.includes(r.id) ? 'checked' : ''}>${r.name}</label>`).join('')}
        </fieldset>
        <fieldset><legend>Вид сладостей</legend>
          ${cats.map((c) => `<label class="check"><input type="checkbox" name="cat" value="${esc(c)}" ${f.cat.includes(c) ? 'checked' : ''}>${esc(c)}</label>`).join('')}
        </fieldset>
        <fieldset><legend>Цена, ₽</legend>
          <div class="grid-2" style="gap:8px">
            <label class="field"><span class="xs muted">От</span><input class="input" name="min" inputmode="numeric" placeholder="${Math.min(...prices)}" value="${esc(f.min)}"></label>
            <label class="field"><span class="xs muted">До</span><input class="input" name="max" inputmode="numeric" placeholder="${Math.max(...prices)}" value="${esc(f.max)}"></label>
          </div>
        </fieldset>
        <button type="button" class="btn btn--block" id="reset">Сбросить фильтры</button>
        <div class="mt-24">${note('Есть аллергия? Проверьте состав в карточке товара и уточните информацию до заказа.')}</div>
      </form>
      <div>
        <div class="catalog__tools">
          <label class="field"><span>Поиск по каталогу</span><input class="input" id="q" type="search" placeholder="Название или любимый вкус" value="${esc(f.q)}"></label>
          <label class="field"><span>Сортировка</span><select class="select" id="sort">
            <option value="">По умолчанию</option><option value="popular" ${f.sort === 'popular' ? 'selected' : ''}>По популярности</option>
            <option value="price_asc" ${f.sort === 'price_asc' ? 'selected' : ''}>Сначала дешевле</option><option value="price_desc" ${f.sort === 'price_desc' ? 'selected' : ''}>Сначала дороже</option>
          </select></label>
        </div>
        <div class="row between" style="margin-bottom:16px"><p class="small muted" id="count"></p>
          <button class="btn btn--sm filters-toggle" id="ftoggle" style="display:none">${icon('filter')} Фильтры</button></div>
        <div class="products products--3" id="grid"></div>
        <div class="mt-32">${note('Ассортимент, цены и фотографии — пример для MVP. Фактическое наличие, состав и сроки годности подтверждаются перед оплатой.')}</div>
      </div>
    </div>
  </div>`;

  const mount = (root) => {
    const form = root.querySelector('#filters');
    const qEl = root.querySelector('#q');
    const sortEl = root.querySelector('#sort');
    const grid = root.querySelector('#grid');
    const count = root.querySelector('#count');
    let pop = null;
    const apply = async () => {
      const region = [...form.querySelectorAll('[name=region]:checked')].map((i) => i.value);
      const cat = [...form.querySelectorAll('[name=cat]:checked')].map((i) => i.value);
      const min = +form.min.value || 0, max = +form.max.value || Infinity;
      const s = qEl.value.trim().toLowerCase();
      let list = all.filter((p) => (!region.length || region.includes(p.region)) && (!cat.length || cat.includes(p.category))
        && p.price_rub >= min && p.price_rub <= max
        && (!s || (p.name + ' ' + p.description + ' ' + p.category).toLowerCase().includes(s)));
      if (sortEl.value === 'price_asc') list.sort((a, b) => a.price_rub - b.price_rub);
      if (sortEl.value === 'price_desc') list.sort((a, b) => b.price_rub - a.price_rub);
      if (sortEl.value === 'popular') {
        pop = pop || (await api('GET', '/api/products?sort=popular')).map((p) => p.id);
        list.sort((a, b) => pop.indexOf(a.id) - pop.indexOf(b.id));
      }
      count.textContent = `Показано ${list.length} ${plural(list.length, 'сладость', 'сладости', 'сладостей')}`;
      grid.innerHTML = list.length ? list.map(productCard).join('')
        : `<div class="empty" style="grid-column:1/-1"><h3>Ничего не нашлось</h3><p class="muted">Попробуйте изменить фильтры или поисковый запрос.</p><button class="btn mt-16" id="reset2">Сбросить фильтры</button></div>`;
      grid.querySelector('#reset2')?.addEventListener('click', reset);
      const params = new URLSearchParams();
      if (region.length) params.set('region', region.join());
      if (cat.length) params.set('cat', cat.join());
      if (s) params.set('q', qEl.value.trim());
      if (form.min.value) params.set('min', form.min.value);
      if (form.max.value) params.set('max', form.max.value);
      if (sortEl.value) params.set('sort', sortEl.value);
      const qs = params.toString();
      history.replaceState(null, '', '#/catalog' + (qs ? '?' + qs : ''));
    };
    const reset = () => { form.reset(); form.querySelectorAll('input[type=checkbox]').forEach((i) => { i.checked = false; }); form.min.value = ''; form.max.value = ''; qEl.value = ''; apply(); };
    form.addEventListener('input', apply);
    qEl.addEventListener('input', apply);
    sortEl.addEventListener('change', apply);
    root.querySelector('#reset').addEventListener('click', reset);
    root.querySelector('#ftoggle').addEventListener('click', () => form.classList.toggle('open'));
    if (query.focus) setTimeout(() => qEl.focus(), 50);
    apply();
  };
  return { html, mount };
}

// ---------------- Карточка товара ----------------
export async function product({ params }) {
  const p = productById(params[0]);
  if (!p || !p.active) return notFound();
  const dir = `${p.region}-${p.region === 'YKT' ? 'DNR' : 'YKT'}`;
  const waves = await api('GET', `/api/waves?direction=${dir}&onlyOpen=1`);
  const w = waves[0];
  const season = w ? seasonInfo(new Date(w.departure).getUTCMonth() + 1) : null;
  const related = active().filter((x) => x.region === p.region && x.id !== p.id).slice(0, 4);
  const html = `<div class="container page">
    ${crumbs([['Главная', '#/'], ['Каталог', '#/catalog'], [REGIONS[p.region].showcase, `#/catalog?region=${p.region}`], [p.name]])}
    <div class="pdp">
      <div class="pdp__img"><img src="${esc(p.photo)}" alt="${esc(p.name)}"></div>
      <div>
        <div class="chips"><span class="chip active">${REGIONS[p.region].showcase}</span>${p.tag ? `<span class="chip">${esc(p.tag)}</span>` : ''}<span class="chip">${esc(p.category)}</span></div>
        <h1>${esc(p.name)}</h1>
        <p class="muted" style="font-size:16px">${esc(p.description)}</p>
        <div class="row mt-16"><span class="small muted">Масса нетто</span><span class="tag">${p.weight_g} г</span>${p.temp_sensitive ? `<span class="tag tag--warn">${icon('thermo')} чувствителен к температуре</span>` : ''}</div>
        <div class="row between mt-24"><span class="price" style="font-size:30px">${rub(p.price_rub)}</span><span class="small muted">${esc(p.manufacturer)}</span></div>
        <div class="row mt-16" style="flex-wrap:nowrap">
          <div class="qty"><button type="button" id="minus" aria-label="Меньше">−</button><span id="qty">1</span><button type="button" id="plus" aria-label="Больше">+</button></div>
          <button class="btn btn--primary grow" id="add">Добавить в корзину ${icon('bag')}</button>
        </div>
        <button class="btn btn--block mt-12" id="gift">Добавить в подарок ${icon('gift')}</button>
        <div class="mt-16">${w ? note(`Доставим сборной отправкой <b>${w.title}</b>. Ближайшая волна: сбор до ${fmtDate(w.cutoff)}, отправка ${fmtDate(w.departure)}, получение ${fmtRange(w.arrivalFrom, w.arrivalTo)}. Сейчас тариф ${w.rate} ₽/кг.`) : note('Ближайшая волна уточняется.')}</div>
        ${p.temp_sensitive && season ? `<div class="mt-12">${note(season.thermoRequired ? season.text : 'Шоколадное изделие: в холодный и жаркий сезон добавим термоупаковку. Сейчас — по желанию.', 'warn')}</div>` : ''}
      </div>
    </div>
    <hr class="divider" style="margin:40px 0">
    <div class="grid-2" style="gap:48px">
      <div><h3>Состав и важная информация</h3><p class="small muted mt-12">${esc(p.composition)}</p><p class="small accent mt-12">Не используйте пример состава при аллергии. Точную информацию уточним по упаковке производителя.</p></div>
      <div><h3>Перед заказом</h3>
        <div class="kv"><span>Регион</span><b>${regionName(p.region)}</b></div>
        <div class="kv"><span>Производитель</span><b>${esc(p.manufacturer)}</b></div>
        <div class="kv"><span>Масса нетто</span><b>${p.weight_g} г</b></div>
        <div class="kv"><span>Срок годности</span><b>${p.shelf_life_days} сут</b></div>
        <div class="kv"><span>Артикул</span><b>${p.id}</b></div>
      </div>
    </div>
    <hr class="divider" style="margin:40px 0">
    <div class="section-head"><h2>Добавьте к чаепитию</h2></div>
    <div class="products">${related.map(productCard).join('')}</div>
  </div>`;
  const mount = (root) => {
    let qty = 1;
    const q = root.querySelector('#qty');
    root.querySelector('#minus').onclick = () => { qty = Math.max(1, qty - 1); q.textContent = qty; };
    root.querySelector('#plus').onclick = () => { qty = Math.min(50, qty + 1); q.textContent = qty; };
    root.querySelector('#add').onclick = () => { addToCart(p.id, qty); refreshChrome(); toast(`Добавлено: ${p.name} × ${qty}`); };
    root.querySelector('#gift').onclick = () => {
      addToCart(p.id, qty);
      setDraft({ gift: true, origin: p.region });
      refreshChrome();
      go('#/cart');
    };
  };
  return { html, mount };
}

export function favorites() {
  const list = state.favs.map(productById).filter((p) => p && p.active);
  return `<div class="container page">
    ${crumbs([['Главная', '#/'], ['Избранное']])}
    <div class="page-head"><h1>Избранное</h1><p>Сладости, к которым хочется вернуться.</p></div>
    ${list.length ? `<div class="products">${list.map(productCard).join('')}</div>`
      : `<div class="empty card card--soft"><h3>Здесь пока пусто</h3><p class="muted">Нажмите на сердечко в карточке товара, чтобы сохранить его.</p><a class="btn btn--primary mt-16" href="#/catalog">В каталог</a></div>`}
  </div>`;
}

// ---------------- Подарки ----------------
export function gift({ query }) {
  const to = query.to || (state.draft.gift && state.draft.origin ? (state.draft.origin === 'YKT' ? 'DNR' : 'YKT') : '');
  const origin = to ? (to === 'YKT' ? 'DNR' : 'YKT') : '';
  const list = origin ? active().filter((p) => p.region === origin).sort((a, b) => (b.category === 'Подарочные наборы') - (a.category === 'Подарочные наборы')) : [];
  const regionCard = (id, title, text) => `<a class="radio-card ${to === id ? 'selected' : ''}" href="#/gift?to=${id}" style="text-decoration:none">
      <input type="radio" name="to" ${to === id ? 'checked' : ''} tabindex="-1"><div><b>${title}</b><p class="small muted mt-8">${text}</p></div></a>`;
  const html = `<div class="container page">
    ${crumbs([['Главная', '#/'], ['Подарочный заказ']])}
    <div class="page-head"><h1>Подарочный заказ</h1><p>Соберите тёплое послание из любимых сладостей и ваших слов.</p></div>
    <div class="gift-block">
      <img src="img/gift.jpg" alt="Подарочная коробка с лентой" style="min-height:240px">
      <div class="gift-block__text"><span class="tag">Подарочная коробка с лентой — ${rub(CONFIG.giftBoxPrice)}</span><h2>Подарок, который преодолевает расстояния</h2>
      <p class="muted">Получатель — в другом регионе. Добавим открытку с вашими словами, а о вручении договоримся заранее. Можно сделать сюрпризом.</p></div>
    </div>
    <div class="layout-aside mt-32">
      <div>
        <div class="card"><h3>1. Где живёт получатель?</h3>
          ${regionCard('DNR', 'В Донбассе', 'Отправим сладости Якутии — вкус Севера для близких в Донецке и области')}
          ${regionCard('YKT', 'В Якутии', 'Отправим сладости Донбасса — тепло юга для близких в Якутске')}
        </div>
        ${origin ? `<div class="mt-24"><div class="section-head"><h2 style="font-size:24px">2. Выберите сладости ${REGIONS[origin].gen}</h2><a class="btn btn--sm" href="#/catalog?region=${origin}">Весь каталог</a></div>
          <div class="products products--3">${list.map(productCard).join('')}</div></div>` : ''}
      </div>
      <aside class="aside">
        <div class="card card--pink"><h3>Как это работает</h3>
          <ol class="how-steps small"><li><span class="num">1</span><div>Выберите регион получателя</div></li><li><span class="num">2</span><div>Добавьте сладости в корзину</div></li><li><span class="num">3</span><div>Выберите волну и напишите открытку</div></li><li><span class="num">4</span><div>Отслеживайте путь подарка</div></li></ol>
        </div>
        ${origin ? `<button class="btn btn--primary btn--block" id="to-cart">Перейти к оформлению ${icon('arrow')}</button>` : ''}
      </aside>
    </div>
  </div>`;
  const mount = (root) => {
    if (origin) setDraft({ gift: true, origin });
    root.querySelector('#to-cart')?.addEventListener('click', () => go('#/cart'));
  };
  return { html, mount };
}

// ---------------- Сборная доставка ----------------
export async function delivery() {
  const waves = await api('GET', '/api/waves?onlyOpen=1');
  const byDir = (d) => waves.filter((w) => w.direction === d).slice(0, 3);
  const months = [['Декабрь — февраль', 'Обязательная термоупаковка для шоколадных изделий (мороз)'], ['Июнь — август', 'Обязательная термоупаковка для шоколадных изделий (перегрев)'], ['Май, ноябрь', 'Межсезонье: срок доставки +7 дней'], ['Март — апрель, сентябрь — октябрь', 'Ограничений нет']];
  const html = `<div class="container page">
    ${crumbs([['Главная', '#/'], ['Сборная доставка']])}
    <div class="page-head"><h1>Сборная доставка</h1><p>Между Якутском и Донецком более 7 000 км. Чтобы доставка не стоила дороже сладостей, мы собираем заказы в общие партии — «волны».</p></div>
    <div class="counter">${Object.keys(DIRECTIONS).map((d) => `<div><h3 style="margin-bottom:14px">${DIRECTIONS[d].title}</h3>${byDir(d).map((w) => `<div style="margin-bottom:12px">${waveMini(w)}</div>`).join('')}</div>`).join('')}</div>

    <div class="grid-2 mt-32" style="gap:24px;align-items:start" id="rules">
      <div class="card"><h3>Правила волн</h3>
        <div class="kv"><span>Периодичность</span><b>1 раз в ${CONFIG.waveIntervalDays} дней в каждом направлении</b></div>
        <div class="kv"><span>Окончание приёма</span><b>за ${CONFIG.cutoffDaysBefore} дня до отправки</b></div>
        <div class="kv"><span>Срок доставки</span><b>${CONFIG.transitDays.join('–')} дней</b></div>
        <div class="kv"><span>Загрузка партии</span><b>от ${CONFIG.minLoadKg} до ${CONFIG.maxLoadKg} кг</b></div>
        <div class="kv"><span>Термоупаковка</span><b>${rub(CONFIG.thermoPrice)} за заказ</b></div>
        <div class="kv"><span>Пункт выдачи / курьер</span><b>бесплатно / ${rub(CONFIG.courierPrice)}</b></div>
        <p class="small muted mt-12">Если к закрытию приёма партия не набрала ${CONFIG.minLoadKg} кг, заказы переносятся в следующую волну — с уведомлением и без доплаты. Оплата — имитация.</p>
      </div>
      <div class="card"><h3>Тариф от заполнения партии</h3>
        <table class="tariff-table"><thead><tr><th>Заполнение партии</th><th>Скидка</th><th>Тариф</th></tr></thead><tbody>
          <tr><td>до 50% (до 150 кг)</td><td>—</td><td>${CONFIG.baseTariff} ₽/кг</td></tr>
          <tr><td>более 50% (150+ кг)</td><td>−20%</td><td>${CONFIG.baseTariff * 0.8} ₽/кг</td></tr>
          <tr><td>более 80% (240+ кг)</td><td>−35%</td><td>${CONFIG.baseTariff * 0.65} ₽/кг</td></tr>
        </tbody></table>
        <p class="formula mt-16">Доставка = вес заказа × тариф</p>
        <p class="small muted">Вес = масса нетто × ${CONFIG.packagingFactor} (упаковка), минимум ${CONFIG.minBillableKg} кг. Тариф считается по загрузке партии вместе с вашим заказом. При закрытии сбора пересчитываем по факту: если тариф снизился — возвращаем разницу, выше — не станет.</p>
      </div>
    </div>

    <div class="grid-2 mt-24" style="gap:24px;align-items:start">
      <div class="card"><h3>Сезонность</h3>
        ${months.map(([m, t]) => `<div class="kv"><span>${m}</span><b style="font-weight:500">${t}</b></div>`).join('')}
        <p class="small muted mt-12">Сезон определяется по месяцу отправки и ожидаемого прибытия партии.</p>
      </div>
      <div class="card card--pink"><h3>Калькулятор доставки</h3>
        <div class="grid-2">
          <label class="field"><span>Направление</span><select class="select" id="c-dir">${waves.map((w) => `<option value="${w.id}">${w.title} · ${fmtDate(w.departure)}</option>`).join('')}</select></label>
          <label class="field"><span>Вес сладостей, кг</span><input class="input" id="c-kg" type="number" min="0.1" max="30" step="0.1" value="1"></label>
        </div>
        <label class="check mt-12"><input type="checkbox" id="c-choc"> Есть шоколадные изделия</label>
        <div id="c-out" class="mt-16"></div>
      </div>
    </div>
  </div>`;
  const mount = (root) => {
    const out = root.querySelector('#c-out');
    const calc = () => {
      const w = waves.find((x) => x.id === root.querySelector('#c-dir').value);
      const k = Math.max(0.1, Math.min(30, +root.querySelector('#c-kg').value || 0.1));
      if (!w) return;
      const q = quote({ items: [{ weight_g: k * 1000, qty: 1, price_rub: 0, temp_sensitive: root.querySelector('#c-choc').checked }], wave: w });
      out.innerHTML = `${fillBar(w.load_kg, q.weightKg, CONFIG.maxLoadKg)}
        <div class="fill-legend"><span>Партия: ${kg(w.load_kg)} + ваши ${kg(q.weightKg)}</span><span>${Math.round(q.fill * 100)}%</span></div>
        <p class="formula">${kg(q.weightKg)} × ${q.rate} ₽/кг = ${rub(q.delivery)}</p>
        <p class="small muted">Отдельной посылкой по базовому тарифу: ${rub(q.baseDelivery)}${q.saving ? ` · экономия <b class="accent">${rub(q.saving)}</b>` : ''}</p>
        ${q.next ? `<p class="small mt-8">Ещё ${kg(q.next.needKg)} в партии — и тариф станет ${q.next.rate} ₽/кг.</p>` : ''}
        ${q.thermo.required ? `<div class="mt-12">${note(`${q.thermo.reason} +${rub(CONFIG.thermoPrice)}`, 'warn')}</div>` : ''}
        ${w.offSeason ? `<div class="mt-12">${note('Межсезонье: срок доставки увеличен на 7 дней.', 'warn')}</div>` : ''}`;
    };
    root.querySelectorAll('#c-dir,#c-kg,#c-choc').forEach((el) => el.addEventListener('input', calc));
    calc();
  };
  return { html, mount };
}

// ---------------- О нас ----------------
export function about() {
  return `<div class="container page">
    ${crumbs([['Главная', '#/'], ['О нас']])}
    <div class="page-head"><h1>О «Сладком мосте»</h1><p>Маркетплейс, который объединяет производителей кондитерских изделий Якутии и Донбасса, покупателей и систему сборной доставки.</p></div>
    <div class="split">
      <img src="img/yakutia.jpg" alt="Сладости Якутии" loading="lazy">
      <div><h2>Зачем мы это делаем</h2>
        <p class="muted mt-16">Жители Якутии и Донбасса интересуются фирменными сладостями друг друга — для себя, в подарок родным и коллегам. Но единичная посылка на 7 000 км может стоить дороже самого товара, а шоколад боится и мороза, и жары.</p>
        <p class="muted mt-12">Мы собираем заказы в общие партии, учитываем сезон и даём удобный подарочный сценарий — чтобы региональные сладости стали доступнее.</p></div>
    </div>
    <h2 class="mt-32" id="business" style="padding-top:24px">Как зарабатывает платформа</h2>
    <div class="biz mt-24">
      <div class="card"><b>15%</b><p class="small">Комиссия с продажи товаров производителей — основной доход.</p></div>
      <div class="card"><b>${rub(CONFIG.giftBoxPrice)}</b><p class="small">Подарочное оформление: коробка с лентой и открытка.</p></div>
      <div class="card"><b>${rub(CONFIG.thermoPrice)}</b><p class="small">Термоупаковка для шоколада — платная услуга (маржа на упаковке).</p></div>
      <div class="card"><b>B2B</b><p class="small">Корпоративные наборы к праздникам — заказ от организаций с индивидуальной сборкой.</p></div>
    </div>
    <p class="small muted mt-16">Доставка продаётся по себестоимости доли в партии: это наше конкурентное преимущество, а не источник прибыли. Модель проверяется расчётом на дашборде администратора.</p>
    <div class="card card--soft mt-32" id="contacts"><h3>Связаться с нами</h3><p class="muted">Вопросы о заказах, сотрудничество с производителями и корпоративные наборы: hello@sladkiy-most.example · +7 (900) 000-00-00 (демо-контакты).</p></div>
  </div>`;
}
