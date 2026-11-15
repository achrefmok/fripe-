import { NextResponse, type NextRequest } from "next/server";

// Cookie de session : posé à la première ouverture du site, il disparaît à la fermeture du navigateur.
// Les scripts de test (scripts/rapport, playwright.config.ts) le posent eux-mêmes pour voir l'accueil.
export const INTRO_COOKIE = "fripe_decouvert";

// Robots d'indexation et aperçus de liens : ils doivent voir l'accueil, pas une redirection.
const BOTS = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|discord|preview|embedly|quora|pinterest/i;

const COOKIE_OPTIONS = { path: "/", sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production" } as const;

// Une vraie ouverture de page dans l'onglet, sans le cookie : pas un préchargement, pas un robot.
function firstOpening(request: NextRequest) {
  if (request.method !== "GET" || request.cookies.has(INTRO_COOKIE)) return false;
  const destination = request.headers.get("sec-fetch-dest");
  if ((destination && destination !== "document") || request.headers.has("rsc") || request.headers.has("next-router-prefetch")) return false;
  return !BOTS.test(request.headers.get("user-agent") ?? "");
}

// Quand on ouvre le site par l'accueil (/ ou /ar), la première page de la session est Découvrir.
// Ensuite, « Entrer dans la friperie » et le logo ramènent à l'accueil habituel.
export function introRedirect(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if ((pathname !== "/" && pathname !== "/ar") || !firstOpening(request)) return null;
  const url = request.nextUrl.clone();
  url.pathname = pathname === "/ar" ? "/ar/decouvrir" : "/decouvrir";
  const response = NextResponse.redirect(url, 307);
  response.cookies.set(INTRO_COOKIE, "1", COOKIE_OPTIONS);
  return response;
}

// Ouvrir le site par une autre page (un lien partagé vers une pièce) compte aussi comme la visite :
// cliquer ensuite sur le logo mène à l'accueil, pas à Découvrir.
export function markOpened(request: NextRequest, response: NextResponse) {
  if (firstOpening(request)) response.cookies.set(INTRO_COOKIE, "1", COOKIE_OPTIONS);
  return response;
}
