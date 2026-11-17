import { NextResponse, type NextRequest } from "next/server";
import { getSuggestions } from "@/features/catalog/suggestions";

// Suggestions de recherche du catalogue : données publiques seulement, mises en cache une minute.
export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 80);
  const locale = request.nextUrl.searchParams.get("locale") === "ar" ? "ar" : "fr";

  try {
    const suggestions = await getSuggestions(query, locale);
    return NextResponse.json(suggestions, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
  } catch (error) {
    console.error("Suggestions indisponibles", error);
    // La recherche classique reste disponible : une liste vide n'empêche pas d'envoyer le formulaire.
    return NextResponse.json({ categories: [], brands: [], pieces: [] }, { headers: { "Cache-Control": "no-store" } });
  }
}
