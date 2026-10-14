import Link from 'next/link';

export default function NotFound() {
  return <main className="container-x py-24 text-center"><h1 className="h2">Страница не найдена</h1><Link className="btn btn-primary mt-6" href="/">На главную</Link></main>;
}
