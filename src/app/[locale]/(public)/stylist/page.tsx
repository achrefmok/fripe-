import { getTranslations } from "next-intl/server";
import { StylistForm } from "@/features/stylist/components/stylist-form";
import { getViewer } from "@/lib/permissions/viewer";

export async function generateMetadata() {
  const t = await getTranslations("stylist");
  return { title: t("title") };
}

export default async function StylistPage() {
  const [viewer, t] = await Promise.all([getViewer(), getTranslations("stylist")]);

  return (
    <div className="mx-auto max-w-[1200px] px-[18px] pb-28 pt-[22px] md:pb-16">
      <p className="luxe-kicker">{t("kicker")}</p>
      <h1 className="mt-1 font-display text-[clamp(34px,5vw,56px)] font-normal leading-none">
        {t.rich("titleRich", { em: (chunks) => <em className="text-goldink">{chunks}</em> })}
      </h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{t("lead")}</p>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("honesty")}</p>
      <div className="mt-6">
        <StylistForm signedIn={Boolean(viewer)} />
      </div>
    </div>
  );
}
