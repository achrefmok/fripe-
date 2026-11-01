import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { OutfitBuilder } from "@/features/stylist/components/outfit-builder";
import { OutfitShare, OutfitViewActions } from "@/features/stylist/components/outfit-share";
import { OutfitPieces } from "@/features/stylist/components/stylist-form";
import { outfitTotal, type Slot, type StyleItem } from "@/features/stylist/engine";
import { getOutfit } from "@/features/stylist/outfits";
import { getViewer } from "@/lib/permissions/viewer";
import { formatPrice, millimesToInput } from "@/lib/utils/price";

export default async function OutfitPage({ params }: PageProps<"/[locale]/tenues/[outfitId]">) {
  const { outfitId } = await params;

  if (!/^[0-9a-f-]{36}$/i.test(outfitId)) {
    notFound();
  }

  const [outfit, viewer, t, locale] = await Promise.all([
    getOutfit(outfitId),
    getViewer(),
    getTranslations("outfits"),
    getLocale(),
  ]);

  if (!outfit) {
    notFound();
  }

  const owner = viewer?.id === outfit.user_id;
  const initial = Object.fromEntries(outfit.items.map((item) => [item.slot, item])) as Partial<Record<Slot, StyleItem>>;

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-6 md:pb-16 md:pt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-4xl font-extrabold">{outfit.name}</h1>
        {outfit.is_public ? <OutfitShare title={outfit.name} /> : null}
      </div>

      {outfit.missing.length ? (
        <p className="mt-3 bg-secondary px-3 py-2 text-sm">
          {t("missing", { pieces: outfit.missing.map((piece) => piece.title).join(", ") })}
        </p>
      ) : null}

      <div className="mt-6">
        {owner ? (
          <OutfitBuilder
            signedIn
            outfitId={outfit.id}
            initial={initial}
            initialName={outfit.name}
            initialBudget={millimesToInput(outfit.budget_millimes)}
            initialPublic={outfit.is_public}
          />
        ) : (
          <>
            <OutfitPieces items={outfit.items} />
            <div className="mt-3 flex items-baseline justify-between">
              <span className="font-semibold">{t("total")}</span>
              <span className="font-display text-2xl font-extrabold">
                {formatPrice(outfitTotal(outfit.items), locale)}
              </span>
            </div>
          </>
        )}
      </div>

      <div className="mt-4">
        <OutfitViewActions
          outfitId={outfit.id}
          productIds={outfit.items.map((item) => item.id)}
          owner={owner}
          signedIn={Boolean(viewer)}
        />
      </div>
    </div>
  );
}
