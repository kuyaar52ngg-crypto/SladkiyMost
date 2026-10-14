import { NextResponse, type NextRequest } from 'next/server';

// Кабинет администратора без cookie сессии сразу отправляем на вход.
// Роль проверяет бэкенд (require_admin) и layout кабинета через /api/auth/me.
export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === '/admin/login' || req.cookies.has('sm_session')) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = '/admin/login';
  url.search = `?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/admin', '/admin/:path*'] };
