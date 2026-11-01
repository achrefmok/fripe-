import { useTranslations } from "next-intl";

export function StagingBanner() {
  const t = useTranslations("staging");

  if (process.env.NEXT_PUBLIC_FRIPE_ENV !== "staging") return null;

  return (
    <p role="status" className="bg-foreground px-4 py-1 text-center text-xs font-semibold text-background">
      {t("banner")}
    </p>
  );
}
