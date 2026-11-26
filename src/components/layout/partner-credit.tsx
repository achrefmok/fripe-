import Image from "next/image";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import mark from "../../../public/brand/gafsa-today-mark.png";

// « بمساهمة قفصة اليوم » : la mention du partenaire, discrète dans l'en-tête, posée en bas de page.
// Dans l'en-tête, le texte disparaît sur les écrans très étroits et entre tablette et grand écran,
// là où les rubriques prennent la place : il ne reste alors que le logo, qui garde son nom accessible.
export function PartnerCredit({ variant = "header", className }: { variant?: "header" | "footer"; className?: string }) {
  const t = useTranslations("partner");

  if (variant === "footer") {
    return (
      <p className={cn("flex items-center justify-center gap-3", className)}>
        <Image src={mark} alt="" className="h-10 w-auto object-contain" />
        <span className="flex flex-col leading-tight">
          <span className="text-xs text-muted-foreground">{t("by")}</span>
          <span className="text-sm font-semibold text-[#a50f08] dark:text-[#e2554c]">{t("name")}</span>
        </span>
      </p>
    );
  }

  return (
    <span title={t("label")} className={cn("inline-flex shrink-0 items-center gap-1.5", className)}>
      <Image src={mark} alt={t("label")} className="h-7 w-auto object-contain md:h-8" />
      <span aria-hidden="true" className="flex flex-col text-[10px] leading-[1.15] max-[479px]:hidden md:max-xl:hidden">
        <span className="text-muted-foreground">{t("by")}</span>
        <span className="font-semibold text-[#a50f08] dark:text-[#e2554c]">{t("name")}</span>
      </span>
    </span>
  );
}
