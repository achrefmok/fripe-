import { MobileTabbar } from "@/components/layout/mobile-tabbar";
import { SiteHeader } from "@/components/layout/site-header";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="contenu" className="mx-auto w-full max-w-2xl flex-1 px-4 pb-24 pt-8 md:pb-16 md:pt-14">
        {children}
      </main>
      <MobileTabbar />
    </>
  );
}
