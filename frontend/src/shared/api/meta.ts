import { get } from './client';
import type { Meta, SiteContent } from './types';

// Значения по умолчанию на случай, если API старее фронтенда (поля content/rules ещё не отдаются):
// витрина не должна падать из-за рассинхрона деплоев.
const CONTENT: SiteContent = {
  banner: { enabled: false, text: '', link: '' },
  hero: {
    overline: 'Якутия и Донбасс · с любовью к родному',
    title: 'Вкус родного края — ближе, чем кажется',
    subtitle: 'Любимые сладости из Якутии и Донбасса. Объединяем заказы в сборные отправки, чтобы доставка была выгоднее.',
    note: 'Для себя, к семейному чаепитию и в подарок близким.',
  },
  contacts: { phone: '', email: '', telegram: '', hours: '' },
  footer: { tagline: 'Сладости, которые делают расстояния меньше.' },
};
const RULES: Meta['rules'] = { orders_open: true, orders_closed_message: '', min_order_rub: 0 };

export function withDefaults(m: Meta): Meta {
  const c: Partial<SiteContent> = m.content ?? {};
  return {
    ...m,
    categories: m.categories ?? [],
    content: {
      banner: { ...CONTENT.banner, ...c.banner }, hero: { ...CONTENT.hero, ...c.hero },
      contacts: { ...CONTENT.contacts, ...c.contacts }, footer: { ...CONTENT.footer, ...c.footer },
    },
    rules: { ...RULES, ...m.rules },
  };
}

export const getMeta = async () => withDefaults(await get<Meta>('/api/meta'));
