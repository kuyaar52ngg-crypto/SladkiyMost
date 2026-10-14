import type { User } from '@/shared/api/types';

/** Кабинет пользователя по роли: администратор — панель, поставщик — кабинет магазина, покупатель — личный кабинет. */
export function cabinetOf(user: Pick<User, 'role'> | null | undefined): { href: string; title: string } {
  if (user?.role === 'admin') return { href: '/admin', title: 'Админ-панель' };
  if (user?.role === 'seller') return { href: '/seller', title: 'Кабинет поставщика' };
  return { href: '/account', title: 'Мои заказы' };
}

/** Куда вести после входа: ссылка на личный кабинет покупателя для админа и поставщика заменяется их кабинетом. */
export function afterLogin(user: Pick<User, 'role'>, next: string): string {
  return user.role !== 'customer' && (next === '/account' || next.startsWith('/account/')) ? cabinetOf(user).href : next;
}
