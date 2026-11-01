import { getLocale, getTranslations } from "next-intl/server";
import { MfaEnroll, RemoveFactorButton } from "@/features/auth/components/mfa-forms";
import { requireAdmin } from "@/lib/permissions/viewer";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils/format";

export default async function SecurityPage() {
  await requireAdmin("/compte/securite");

  const supabase = await createClient();
  const [{ data }, t, locale] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    getTranslations("mfa"),
    getLocale(),
  ]);

  const factors = data?.totp ?? [];

  return (
    <>
      <h1 className="font-display text-3xl font-extrabold">{t("devicesTitle")}</h1>
      <p className="mt-1 text-muted-foreground">{t("devicesHint")}</p>

      <ul className="mt-4 divide-y border-y">
        {factors.map((factor) => (
          <li key={factor.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <span className="min-w-0">
              <span className="block font-semibold">{factor.friendly_name}</span>
              <span className="block text-sm text-muted-foreground">
                {t("addedOn", { date: formatDate(factor.created_at, locale) })}
              </span>
            </span>
            {factors.length > 1 ? (
              <RemoveFactorButton factorId={factor.id} name={factor.friendly_name ?? ""} />
            ) : null}
          </li>
        ))}
      </ul>
      {factors.length === 1 ? <p className="mt-2 text-sm text-muted-foreground">{t("lastDevice")}</p> : null}

      <section className="mt-8 max-w-md">
        <h2 className="font-display text-xl font-bold">{t("addDevice")}</h2>
        <div className="mt-3">
          <MfaEnroll next="/compte/securite" defaultName="" />
        </div>
      </section>
    </>
  );
}
