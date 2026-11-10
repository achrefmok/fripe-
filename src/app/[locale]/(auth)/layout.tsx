import Image from "next/image";
import { useTranslations } from "next-intl";
import { BrandLink } from "@/components/layout/brand";
import { LocaleSwitch, ThemeToggle } from "@/components/layout/header-controls";
import cover from "../../../../public/visuals/connexion-poncho.jpg";

// Friptex Luxe : à gauche, la nuit, une pièce et l'étiquette Friptex qui se balance ;
// à droite, le formulaire aux champs soulignés.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("auth");

  return (
    <div className="flex min-h-svh flex-col">
      <header className="luxe-header">
        <div className="mx-auto flex max-w-[1200px] items-center gap-1 px-[18px] py-2.5">
          <BrandLink className="me-auto" />
          <LocaleSwitch compact />
          <ThemeToggle />
        </div>
      </header>
      <div className="zellige" aria-hidden="true" />
      <main id="contenu" className="mx-auto flex w-full max-w-[1200px] flex-1 flex-wrap gap-[18px] px-[18px] pt-[18px] pb-12">
        <div className="lx-authpanel" aria-hidden="true">
          <Image src={cover} alt="" fill priority placeholder="blur" sizes="(min-width: 768px) 50vw, 100vw" className="lx-authpanel__photo" />
          <span className="lx-authpanel__veil" />
          <span className="lx-authpanel__tag">
            <span className="lx-authpanel__thread" />
            <span className="lx-authpanel__label">Friptex</span>
          </span>
          <p className="lx-authpanel__title">{t.rich("panelTitle", { em: (chunks) => <em>{chunks}</em> })}</p>
        </div>
        <div className="flex flex-[1_1_340px] flex-col justify-center p-[clamp(10px,4vw,40px)]">
          <div className="w-full max-w-[520px]">{children}</div>
        </div>
      </main>
    </div>
  );
}
