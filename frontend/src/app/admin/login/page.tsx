'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { AuthForm } from '@/features/auth/AuthForm';
import { useShop } from '@/features/shop/store';
import { post } from '@/shared/api/client';
import { Logo } from '@/widgets/Logo';

function AdminLogin() {
  const { user, setUser } = useShop();
  const router = useRouter();
  const raw = useSearchParams().get('next') || '/admin';
  const next = raw.startsWith('/admin') ? raw : '/admin';
  const [err, setErr] = useState('');
  useEffect(() => { if (user?.role === 'admin') router.replace(next); }, [user, next, router]);
  return (
    <main className="container-x max-w-[480px] py-12">
      <div className="mb-6 flex justify-center"><Logo /></div>
      <div className="card"><h2 className="h2">Кабинет администратора</h2><p className="mt-2 mb-5 text-muted">Управление товарами, волнами и статусами заказов.</p>
        <AuthForm allowRegister={false} onDone={async (u) => {
          if (u.role === 'admin') { router.replace(next); return; }
          await post('/api/auth/logout').catch(() => null);
          setUser(null);
          setErr('У этого аккаунта нет прав администратора');
        }} />
        {err && <p role="alert" className="mt-3 text-xs text-accent">{err}</p>}
      </div>
      <p className="mt-4 text-center"><Link className="link" href="/">← Вернуться на сайт</Link></p>
    </main>
  );
}

export default function Page() {
  return <Suspense><AdminLogin /></Suspense>;
}
