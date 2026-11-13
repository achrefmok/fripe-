import { getTranslations, setRequestLocale } from "next-intl/server";
import { CrushDeck } from "@/features/dressing/components/crush-deck";
import { DressingFavorites } from "@/features/dressing/components/favorites";
import { getDailyPicks } from "@/features/dressing/queries";
import { Link } from "@/i18n/navigation";

export const revalidate = 600;

export async function generateMetadata() {
  const t = await getTranslations("dressing");
  return { title: t("crushMode") };
}

// Le mode Coup de foudre : cinq pièces du jour, une à une, à garder ou à passer d'un geste.
export default async function CoupDeFoudrePage({ params }: PageProps<"/[locale]/vide-dressing/coup-de-foudre">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [picks, t] = await Promise.all([getDailyPicks(5), getTranslations("dressing")]);

  return (
    <DressingFavorites next="/vide-dressing/coup-de-foudre">
      <div className="vd-page vd-page--crush">
        {picks.length ? (
          <CrushDeck items={picks} />
        ) : (
          <div className="vd-empty mt-10 text-center">
            <p className="text-muted-foreground">{t("crushEmpty")}</p>
            <Link href="/vide-dressing" className="mt-4 inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
              {t("backToAll")}
            </Link>
          </div>
        )}
      </div>
    </DressingFavorites>
  );
}
