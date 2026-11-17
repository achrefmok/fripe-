"use client";

import { Clock, Search, Tag, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import type { Suggestions } from "../suggestions";

const RECENT_KEY = "fripe:recherches";
const RECENT_MAX = 6;

function readRecent(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

// Mémorise une recherche dans ce navigateur seulement (rien n'est envoyé au serveur).
export function rememberSearch(query: string) {
  const text = query.trim();
  if (!text) return;
  try {
    const next = [text, ...readRecent().filter((entry) => entry.toLowerCase() !== text.toLowerCase())].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Stockage indisponible (navigation privée) : la recherche fonctionne sans historique.
  }
}

type Option = { key: string; label: string; kind: "recent" | "category" | "brand" | "piece"; go: () => void };

// Le champ de recherche du catalogue, avec suggestions et recherches récentes. Sans JavaScript ou si
// les suggestions ne répondent pas, c'est un champ de recherche ordinaire : le formulaire part tel quel.
export function SearchSuggest({ defaultValue, placeholder, label }: { defaultValue: string; placeholder: string; label: string }) {
  const t = useTranslations("catalog");
  const locale = useLocale();
  const router = useRouter();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState<string[]>([]);
  const [found, setFound] = useState<Suggestions | null>(null);

  // Les suggestions arrivent après une courte pause de frappe, et seulement à partir de deux lettres.
  useEffect(() => {
    const text = value.trim();
    if (text.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/suggestions?q=${encodeURIComponent(text)}&locale=${locale}`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : null))
        .then((data: Suggestions | null) => setFound(data))
        .catch(() => undefined);
    }, 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, locale]);

  const searching = value.trim().length >= 2;
  const groups: { title: string; options: Option[] }[] = searching && found
    ? [
        {
          title: t("suggestCategories"),
          options: found.categories.map((category) => ({ key: `c-${category.slug}`, label: category.label, kind: "category" as const, go: () => router.push({ pathname: "/catalogue", query: { categorie: category.slug } }) })),
        },
        {
          title: t("suggestBrands"),
          options: found.brands.map((brand) => ({ key: `b-${brand}`, label: brand, kind: "brand" as const, go: () => router.push({ pathname: "/catalogue", query: { marque: brand } }) })),
        },
        {
          title: t("suggestPieces"),
          options: found.pieces.map((piece) => ({ key: `p-${piece.id}`, label: piece.title, kind: "piece" as const, go: () => router.push(`/produit/${piece.id}`) })),
        },
      ].filter((group) => group.options.length)
    : !searching && recent.length
      ? [
          {
            title: t("recentSearches"),
            options: recent.map((entry) => ({
              key: `r-${entry}`,
              label: entry,
              kind: "recent" as const,
              go: () => {
                rememberSearch(entry);
                router.push({ pathname: "/catalogue", query: { q: entry } });
              },
            })),
          },
        ]
      : [];
  const options = groups.flatMap((group) => group.options);
  const expanded = open && options.length > 0;

  const choose = (option: Option) => {
    setOpen(false);
    option.go();
  };

  return (
    <div className="relative">
      <Input
        ref={input}
        id="q"
        name="q"
        type="search"
        autoComplete="off"
        role="combobox"
        aria-label={label}
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={`${id}-list`}
        aria-activedescendant={expanded && active >= 0 ? `${id}-option-${active}` : undefined}
        value={value}
        placeholder={placeholder}
        onFocus={() => {
          setRecent(readRecent());
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={(event) => {
          setValue(event.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            return;
          }
          if (!expanded) return;
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const step = event.key === "ArrowDown" ? 1 : -1;
            setActive((current) => (current + step + options.length) % options.length);
          } else if (event.key === "Enter" && active >= 0) {
            event.preventDefault();
            choose(options[active]);
          }
        }}
      />
      {expanded ? (
        <div id={`${id}-list`} role="listbox" aria-label={label} className="absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-[14px] border border-border bg-popover text-popover-foreground shadow-lg">
          {groups.map((group) => (
            <div key={group.title} role="group" aria-label={group.title} className="py-1">
              <div className="flex items-center justify-between px-3 pt-1.5 pb-1 text-[0.72rem] font-semibold tracking-wide text-muted-foreground uppercase rtl:tracking-normal">
                <span>{group.title}</span>
                {group.options[0]?.kind === "recent" ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 normal-case hover:text-foreground"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      try {
                        localStorage.removeItem(RECENT_KEY);
                      } catch {}
                      setRecent([]);
                      input.current?.focus();
                    }}
                  >
                    <X className="size-3" aria-hidden="true" />
                    {t("clearRecent")}
                  </button>
                ) : null}
              </div>
              {group.options.map((option) => {
                const index = options.indexOf(option);
                const Icon = option.kind === "recent" ? Clock : option.kind === "piece" ? Search : Tag;
                return (
                  <div
                    key={option.key}
                    id={`${id}-option-${index}`}
                    role="option"
                    aria-selected={index === active}
                    className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm aria-selected:bg-muted hover:bg-muted"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => choose(option)}
                  >
                    <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="truncate" dir="auto">{option.label}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
