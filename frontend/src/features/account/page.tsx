import type { ReactNode } from 'react';
import { Crumbs } from '@/shared/ui';

/** Шапка страницы кабинета: «Личный кабинет / …», заголовок, подзаголовок. */
export function AccountHead({ title, crumb, text, children }: { title: string; crumb?: string; text?: string; children?: ReactNode }) {
  return (
    <div className="mb-7">
      <Crumbs items={[['Личный кабинет', '/account'], [crumb || title]]} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="h1-sm">{title}</h1>
        {children}
      </div>
      {text && <p className="mt-4 text-[15px] text-muted">{text}</p>}
    </div>
  );
}
