"use client";

import { FileUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/field";
import { importProductsCsv } from "@/features/catalog/actions";
import { MAX_CSV_ROWS } from "@/features/catalog/constants";
import {
  validateCsvRows,
  type CategoryOption,
  type CsvRowResult,
} from "@/features/catalog/csv-import";
import { useRouter } from "@/i18n/navigation";
import { parseCsv } from "@/lib/utils/csv";

const TEMPLATE =
  "titre;categorie;prix;etat;marque;taille;couleur;reference;description;defauts\n" +
  "Jean droit;jeans;30;bon etat;Levis;M;bleu;;;\n";

export function CsvImporter({ shopId, categories }: { shopId: string; categories: CategoryOption[] }) {
  const t = useTranslations("sellerShop");
  const validation = useTranslations("validation");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [results, setResults] = useState<CsvRowResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function read(file: File | undefined) {
    if (!file) return;

    const parsed = parseCsv(await file.text());
    setError(parsed.length > MAX_CSV_ROWS ? "csvTooLarge" : null);
    setRows(parsed);
    setResults(parsed.length > MAX_CSV_ROWS ? null : validateCsvRows(parsed, categories));
  }

  const valid = results?.filter((result) => result.ok).length ?? 0;
  const invalid = results?.flatMap((result) => (result.ok ? [] : [result])) ?? [];

  return (
    <div className="grid gap-3">
      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        aria-label={t("quickCsvButton")}
        onChange={(event) => read(event.target.files?.[0])}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={() => input.current?.click()}>
          <FileUp />
          {t("quickCsvButton")}
        </Button>
        <a
          download="fripe-modele.csv"
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(`﻿${TEMPLATE}`)}`}
          className="text-sm font-medium underline underline-offset-4"
        >
          {t("quickCsvTemplate")}
        </a>
      </div>

      {results && !results.length ? (
        <p className="text-sm text-muted-foreground">{t("quickCsvEmpty")}</p>
      ) : null}

      {results?.length ? (
        <div className="grid gap-2">
          <p role="status" className="font-semibold">
            {t("quickCsvPreview", { ok: valid, bad: invalid.length })}
          </p>
          {invalid.length ? (
            <ul className="max-h-48 overflow-y-auto text-sm text-destructive">
              {invalid.map((row) => (
                <li key={row.line}>
                  {t("quickCsvLine", { line: row.line })} :{" "}
                  {validation.has(row.error) ? validation(row.error) : row.error}
                </li>
              ))}
            </ul>
          ) : null}
          {valid ? (
            <Button
              disabled={pending}
              className="justify-self-start"
              onClick={() =>
                startTransition(async () => {
                  const result = await importProductsCsv(shopId, rows);

                  if (result.ok) {
                    toast.success(t("quickCsvDone", { created: result.data.created }));
                    router.push(`/vendeur/boutique/${shopId}/produits?onglet=draft`);
                  } else {
                    setError(result.error);
                  }
                })
              }
            >
              {t("quickCsvImport")}
            </Button>
          ) : null}
        </div>
      ) : null}

      <FormError error={error} />
    </div>
  );
}
