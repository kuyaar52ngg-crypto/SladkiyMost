import Link from 'next/link';

export function Logo({ align = 'center', href = '/' }: { align?: 'center' | 'start'; href?: string }) {
  return (
    <Link href={href} aria-label="Сладкий мост — на главную"
      className={`flex shrink-0 flex-col gap-1.5 ${align === 'center' ? 'items-center max-md:items-start' : 'items-start'}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/img/logo.svg" alt="" width={80} height={48} className="h-auto w-14 md:w-24" />
      <span className="font-brand text-[13px] font-extrabold whitespace-nowrap md:text-lg">СЛАДКИЙ МОСТ</span>
    </Link>
  );
}
