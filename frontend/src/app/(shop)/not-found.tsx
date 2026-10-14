import Link from 'next/link';
import { Empty } from '@/shared/ui';

export default function NotFound() {
  return <div className="container-x py-10"><Empty title="Страница не найдена" text="Возможно, ссылка устарела."><Link className="btn btn-primary" href="/">На главную</Link></Empty></div>;
}
