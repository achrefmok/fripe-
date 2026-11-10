import { getTranslations } from "next-intl/server";
import { listRackProducts } from "@/features/catalog/queries";
import { RackSwipe } from "@/features/home/components/rack-swipe";

export const revalidate = 60;

export async function generateMetadata() {
  const t = await getTranslations("chine");
  return { title: t("title") };
}

// Le portant à chiner : les dernières pièces, cintre par cintre.
export default async function ChinePage() {
  const [products, t] = await Promise.all([listRackProducts(24).catch(() => []), getTranslations("chine")]);

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-3.5 overflow-hidden px-[18px] pb-28 pt-[22px] md:pb-10">
      <div className="flex flex-col gap-1.5 text-center">
        <span className="luxe-kicker">{t("kicker")}</span>
        <h1 className="font-display text-[clamp(34px,5vw,56px)] font-normal leading-none">
          {t.rich("heading", { em: (chunks) => <em className="text-goldink">{chunks}</em> })}
        </h1>
        <p className="text-sm text-muted-foreground">{t("lead")}</p>
      </div>
      <RackSwipe products={products} />
    </div>
  );
}
