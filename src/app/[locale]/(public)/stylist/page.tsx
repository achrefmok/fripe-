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
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6 md:pb-16 md:pt-10">
      <h1 className="font-display text-4xl font-extrabold">{t("title")}</h1>
      <p className="mt-2 text-muted-foreground">{t("lead")}</p>
      <p className="mt-1 text-sm text-muted-foreground">{t("honesty")}</p>
      <div className="mt-6">
        <StylistForm signedIn={Boolean(viewer)} />
      </div>
    </div>
  );
}
