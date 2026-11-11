import { getTranslations, setRequestLocale } from "next-intl/server";
import { LiveCard } from "@/features/live/components/live-card";
import { listPublicLives } from "@/features/live/queries";
import { Link } from "@/i18n/navigation";

export const revalidate = 30;

export async function generateMetadata() {
  const t = await getTranslations("live");
  return { title: t("title"), description: t("lead") };
}

// Les Lives : ce qui passe en ce moment d'abord, puis ce qui arrive, puis ce qui vient de se terminer.
export default async function LivesPage({ params }: PageProps<"/[locale]/lives">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [lives, t] = await Promise.all([
    listPublicLives().catch(() => ({ live: [], scheduled: [], ended: [] })),
    getTranslations("live"),
  ]);

  const sections = [
    { id: "direct", title: t("liveNowTitle"), items: lives.live },
    { id: "bientot", title: t("scheduledTitle"), items: lives.scheduled },
    { id: "termines", title: t("endedTitle"), items: lives.ended },
  ].filter((section) => section.items.length);

  return (
    <div className="lives-page">
      <header className="lives-hero">
        <p className="live-kicker">{t("kicker")}</p>
        <h1 className="lives-hero__title">{t.rich("heading", { em: (chunks) => <em>{chunks}</em> })}</h1>
        <p className="lives-hero__lead">{t("lead")}</p>
      </header>

      {sections.length ? (
        sections.map((section) => (
          <section key={section.id} className="mt-9" aria-labelledby={`lives-${section.id}`}>
            <h2 id={`lives-${section.id}`} className="font-display text-[clamp(24px,3vw,32px)] font-normal">{section.title}</h2>
            <ul className="lives-grid">
              {section.items.map((live) => (
                <li key={live.id}>
                  <LiveCard live={live} />
                </li>
              ))}
            </ul>
          </section>
        ))
      ) : (
        <div className="vd-empty mt-9">
          <h2 className="font-display text-2xl">{t("emptyTitle")}</h2>
          <p className="mt-2 max-w-md text-muted-foreground">{t("emptyBody")}</p>
          <Link href="/boutiques" className="mt-4 inline-flex min-h-10 items-center font-medium text-goldink underline underline-offset-4">{t("seeShops")}</Link>
        </div>
      )}
    </div>
  );
}
