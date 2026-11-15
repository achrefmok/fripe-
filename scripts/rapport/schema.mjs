// Lit src/types/database.ts avec le compilateur TypeScript et en tire un schéma simple : colonnes et
// types des tables et vues, relations, valeurs des enums, forme du retour des fonctions RPC.
// Le faux Supabase s'en sert pour fabriquer des lignes qui ont la bonne forme.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const FILE = fileURLToPath(new URL("../../src/types/database.ts", import.meta.url));

function member(node, name) {
  return node.members?.find((entry) => entry.name?.getText() === name);
}

export function loadSchema() {
  const source = ts.createSourceFile(FILE, readFileSync(FILE, "utf8"), ts.ScriptTarget.Latest, true);
  let database;
  source.forEachChild((node) => {
    if (ts.isTypeAliasDeclaration(node) && node.name.text === "Database") database = node.type;
  });
  const publicSchema = member(database, "public").type;

  const enums = {};
  for (const entry of member(publicSchema, "Enums").type.members) {
    const type = entry.type;
    const values = ts.isUnionTypeNode(type) ? type.types : [type];
    enums[entry.name.getText()] = values.filter(ts.isLiteralTypeNode).map((literal) => literal.literal.text);
  }

  // Une colonne : son type de base, nullable ou non, tableau ou non, enum éventuel.
  function describe(type) {
    let nullable = false;
    let parts = ts.isUnionTypeNode(type) ? type.types : [type];
    if (parts.some((part) => part.kind === ts.SyntaxKind.LiteralType && part.literal.kind === ts.SyntaxKind.NullKeyword)) nullable = true;
    parts = parts.filter((part) => !(part.kind === ts.SyntaxKind.LiteralType && part.literal.kind === ts.SyntaxKind.NullKeyword));
    let main = parts[0];
    let array = false;
    if (main && ts.isArrayTypeNode(main)) {
      array = true;
      main = main.elementType;
    }
    if (!main) return { kind: "string", nullable };
    if (ts.isTypeLiteralNode(main)) return { kind: "object", nullable, array, columns: columnsOf(main) };
    if (ts.isIndexedAccessTypeNode(main)) {
      const name = main.indexType.literal?.text;
      if (enums[name]) return { kind: "enum", values: enums[name], nullable, array };
    }
    if (parts.every((part) => ts.isLiteralTypeNode(part) && ts.isStringLiteral(part.literal))) {
      return { kind: "enum", values: parts.map((part) => part.literal.text), nullable, array };
    }
    const text = main.getText();
    if (text === "number") return { kind: "number", nullable, array };
    if (text === "boolean") return { kind: "boolean", nullable, array };
    if (text === "Json") return { kind: "json", nullable, array };
    if (text === "undefined" || text === "never") return { kind: "void", nullable, array };
    return { kind: "string", nullable, array };
  }

  function columnsOf(literal) {
    const columns = {};
    for (const entry of literal.members) columns[entry.name.getText().replace(/"/g, "")] = describe(entry.type);
    return columns;
  }

  const relations = {};
  for (const group of ["Tables", "Views"]) {
    for (const entry of member(publicSchema, group).type.members) {
      const name = entry.name.getText();
      const row = member(entry.type, "Row");
      const links = member(entry.type, "Relationships");
      const relationships = [];
      if (links && ts.isTupleTypeNode(links.type)) {
        for (const link of links.type.elements) {
          const columns = member(link, "columns")?.type.elements?.map((element) => element.literal.text) ?? [];
          const referenced = member(link, "referencedRelation")?.type.literal?.text;
          const key = member(link, "foreignKeyName")?.type.literal?.text;
          if (referenced) relationships.push({ columns, referenced, key });
        }
      }
      relations[name] = { columns: row ? columnsOf(row.type) : {}, relationships };
    }
  }

  const functions = {};
  for (const entry of member(publicSchema, "Functions").type.members) {
    const returns = member(entry.type, "Returns");
    functions[entry.name.getText()] = returns ? describe(returns.type) : { kind: "void" };
  }

  return { enums, relations, functions };
}
