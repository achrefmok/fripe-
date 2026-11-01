// Analyse CSV conforme RFC 4180. Détecte « ; », séparateur par défaut d'Excel en français.
export function parseCsv(text: string): Record<string, string>[] {
  const content = text.replace(/^﻿/, "");
  const firstLine = content.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = firstLine.split(";").length > firstLine.split(",").length ? ";" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];

    if (quoted) {
      if (char === '"' && content[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && content[index + 1] === "\n") index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  const [header, ...lines] = rows.filter((line) => line.some((cell) => cell.trim()));
  if (!header) return [];

  const keys = header.map((key) => key.trim().toLowerCase());

  return lines.map((line) =>
    Object.fromEntries(keys.map((key, index) => [key, (line[index] ?? "").trim()])),
  );
}
