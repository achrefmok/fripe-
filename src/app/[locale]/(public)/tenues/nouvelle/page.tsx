import { getTranslations } from "next-intl/server";
import { OutfitBuilder } from "@/features/stylist/components/outfit-builder";
import type { Slot, StyleItem } from "@/features/stylist/engine";
import { getStyleCatalog } from "@/features/stylist/queries";
import { getViewer } from "@/lib/permissions/viewer";

export default async function NewOutfitPage({ searchParams }: PageProps<"/[locale]/tenues/nouvelle">) {
  const { pieces } = await searchParams;
  const ids =
    typeof pieces === "string"
      ? pieces.split(",").filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 4)
      : [];

  const [viewer, t, items] = await Promise.all([
    getViewer(),
    getTranslations("outfits"),
    ids.length ? getStyleCatalog({ ids }) : Promise.resolve<StyleItem[]>([]),
  ]);

  const initial = Object.fromEntries(items.map((item) => [item.slot, item])) as Partial<Record<Slot, StyleItem>>;

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-6 md:pb-16 md:pt-10">
      <p className="luxe-kicker">{t("builderKicker")}</p>
      <h1 className="mt-1 font-display text-[clamp(34px,5vw,56px)] font-normal leading-none">{t.rich("builderTitleRich", { em: (chunks) => <em className="text-goldink">{chunks}</em> })}</h1>
      <p className="mt-2 text-muted-foreground">{t("builderLead")}</p>
      <div className="mt-6">
        <OutfitBuilder signedIn={Boolean(viewer)} initial={initial} />
      </div>
    </div>
  );
}
