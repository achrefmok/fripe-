import { getLocale } from "next-intl/server";
import ar from "./content/ar.json";
import fr from "./content/fr.json";

export type LegalSlug = keyof typeof fr.pages;

const PLACEHOLDER = /(\[\[.+?\]\])/;

// [[…]] marque une information que seul un humain peut valider : elle ne doit jamais passer
// inaperçue. La mention de brouillon disparaît d'elle-même quand il n'en reste aucune.
function Text({ value }: { value: string }) {
  return value.split(PLACEHOLDER).map((part, index) =>
    part.startsWith("[[") ? (
      <mark key={index} data-legal-placeholder className="bg-harissa/15 px-1 font-semibold text-foreground">
        {part.slice(2, -2)}
      </mark>
    ) : (
      part
    ),
  );
}

export async function legalTitle(slug: LegalSlug) {
  const content = (await getLocale()) === "ar" ? ar : fr;
  return content.pages[slug].title;
}

export async function LegalPage({ slug }: { slug: LegalSlug }) {
  const content = (await getLocale()) === "ar" ? ar : fr;
  const page = content.pages[slug];
  const isDraft = page.sections.some((section) => section.body.some((line) => PLACEHOLDER.test(line)));

  return (
    <article className="mx-auto grid max-w-2xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-10 md:py-16">
      <h1 className="font-display text-4xl leading-tight font-extrabold">{page.title}</h1>

      {isDraft ? (
        <p role="note" className="border-s-2 border-harissa bg-secondary px-3 py-2 text-sm font-medium">
          {content.draftNotice}
        </p>
      ) : null}

      {page.sections.map((section) => (
        <section key={section.heading} className="grid gap-2">
          <h2 className="font-display text-xl font-bold">{section.heading}</h2>
          {section.body.map((line, index) => (
            <p key={index} className="leading-relaxed">
              <Text value={line} />
            </p>
          ))}
        </section>
      ))}
    </article>
  );
}
