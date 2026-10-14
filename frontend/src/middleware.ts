import { NextResponse, type NextRequest } from 'next/server';

// Кабинеты администратора и поставщика без cookie сессии сразу отправляем на вход.
// Роль проверяет бэкенд (require_admin / require_seller) и layout кабинета через /api/auth/me.
export function middleware(req: NextRequest) {
  const area = req.nextUrl.pathname.startsWith('/seller') ? '/seller' : '/admin';
  if (req.nextUrl.pathname === `${area}/login` || req.cookies.has('sm_session')) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = `${area}/login`;
  url.search = `?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/admin', '/admin/:path*', '/seller', '/seller/:path*'] };
