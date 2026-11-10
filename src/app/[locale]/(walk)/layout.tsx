import { MobileTabbar } from "@/components/layout/mobile-tabbar";
import { SiteHeader } from "@/components/layout/site-header";

// Pas de pied de page : le fil occupe toute la hauteur entre l'en-tête et la barre d'onglets.
export default function WalkLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-svh flex-col overflow-hidden">
      <SiteHeader />
      <main id="contenu" className="min-h-0 flex-1 pb-[calc(5.75rem+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </main>
      <MobileTabbar />
    </div>
  );
}
