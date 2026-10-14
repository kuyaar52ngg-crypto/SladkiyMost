'use client';
import { useEffect } from 'react';

/** Ссылка из письма Supabase может вернуть на главную (Site URL) — переносим токен на страницу смены пароля. */
export function EmailLinkRedirect() {
  useEffect(() => {
    const h = window.location.hash;
    if (window.location.pathname !== '/reset' && /[#&](access_token|error_description)=/.test(h) && !h.includes('tgWebAppData')) {
      window.location.replace(`/reset${h}`);
    }
  }, []);
  return null;
}
