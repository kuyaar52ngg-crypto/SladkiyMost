'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { AuthForm } from '@/features/auth/AuthForm';
import { useShop } from '@/features/shop/store';
import { afterLogin } from '@/shared/lib/cabinet';
import { Icon } from '@/shared/ui';

function Login() {
  const { user } = useShop();
  const router = useRouter();
  const sp = useSearchParams();
  const raw = sp.get('next') || '/account';
  const next = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/account';
  const reg = sp.get('mode') === 'register';
  useEffect(() => { if (user) router.replace(afterLogin(user, next)); }, [user, next, router]);

  return (
    <main className="mx-auto grid min-h-screen max-w-[1200px] items-start gap-10 px-4 py-6 sm:px-6 md:grid-cols-[1fr_1fr] md:gap-16 md:py-10 lg:py-14">
      <div className="relative hidden overflow-hidden rounded-card md:block md:min-h-[620px] md:self-stretch">
        <Image src="/img/hero.jpg" alt="Зефир и трюфели к чаю" fill priority sizes="50vw" className="object-cover" />
        <Link href="/" aria-label="На главную" className="absolute inset-x-0 top-0 flex flex-col items-center gap-1.5 bg-ink py-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/logo.svg" alt="" width={64} height={38} className="w-14" />
          <span className="font-brand text-[13px] font-extrabold text-white">СЛАДКИЙ МОСТ</span>
        </Link>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-8 pt-24 pb-8 text-white">
          <p className="font-head text-[28px] leading-tight font-bold">Любимые сладости —<br />ещё ближе</p>
          <p className="mt-2 text-[13px] text-white/85">Сладости Якутии и Донбасса со сборной доставкой.</p>
        </div>
      </div>
      <div className="md:pt-16">
        <Link href="/" className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-accent md:hidden"><Icon name="back" className="size-4" />В магазин</Link>
        <h1 className="font-head text-[32px] font-bold">{reg ? 'Регистрация' : 'Вход'}</h1>
        <p className="mt-2 mb-6 text-[15px] text-muted">{reg ? 'Создайте аккаунт, чтобы сохранять данные для заказов и следить за отправками.' : 'Рады видеть вас снова. Войдите, чтобы посмотреть свои заказы и детали доставки.'}</p>
        <AuthForm key={reg ? 'r' : 'l'} mode={reg ? 'register' : 'login'} next={next} onDone={(u) => router.replace(afterLogin(u, next))} />
        {!reg && (
          <div className="mt-8">
            <p className="mb-3 text-[13px] font-semibold">Для поставщиков и сотрудников</p>
            <div className="space-y-2 text-sm">
              <Link href="/seller/login" className="flex items-center justify-between rounded-lg border border-line px-4 py-3 hover:border-line-strong">Вход поставщика<Icon name="arrow" className="size-4" /></Link>
              <Link href="/admin/login" className="flex items-center justify-between rounded-lg border border-line px-4 py-3 hover:border-line-strong">Вход администратора<Icon name="arrow" className="size-4" /></Link>
            </div>
            <p className="mt-6 text-center text-[13px]"><Link className="text-muted underline underline-offset-2 hover:text-accent" href="/orders">Найти заказ без входа</Link></p>
          </div>
        )}
      </div>
    </main>
  );
}

export default function LoginPage() {
  return <Suspense><Login /></Suspense>;
}
