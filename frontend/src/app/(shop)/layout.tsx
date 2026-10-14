import { Footer } from '@/widgets/Footer';
import { Header, TabBar } from '@/widgets/Header';

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pb-[72px] md:pb-0">
      <Header />
      <main>{children}</main>
      <Footer />
      <TabBar />
    </div>
  );
}
