import { Link } from "@/i18n/navigation";

// Le bandeau d'or qui défile : les dernières pièces arrivées, comme un fil d'annonces au marché.
// Il s'arrête au survol et au focus ; sans mouvement, il devient une rangée qu'on fait glisser.
export function VdTicker({ label, entries }: { label: string; entries: { id: string; text: string }[] }) {
  if (!entries.length) return null;

  const row = (copy: number) => (
    <ul className="vd-ticker__row" aria-hidden={copy ? true : undefined}>
      {entries.map((entry) => (
        <li key={entry.id}>
          <Link href={`/annonce/${entry.id}`} tabIndex={copy ? -1 : undefined} dir="auto">
            {entry.text}
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <section className="vd-ticker" aria-label={label}>
      <div className="vd-ticker__track">
        {row(0)}
        {row(1)}
      </div>
    </section>
  );
}
