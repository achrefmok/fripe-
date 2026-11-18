import { withSerwist } from "@serwist/turbopack";
import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const isDev = process.env.NODE_ENV === "development";
const isStaging = process.env.NEXT_PUBLIC_FRIPE_ENV === "staging";

// 'unsafe-inline' reste nécessaire tant que les pages sont statiques : voir docs/securite-phase-5.md.
// script-src-attr bloque tout de même les gestionnaires en ligne (onclick=…), que Next n'utilise pas.
// Contentsquare (analyse des parcours) : son script, ses envois et ses pixels.
const contentsquare = {
  script: "*.contentsquare.net app.contentsquare.com",
  connect: "*.contentsquare.net *.contentsquare.com",
  img: "*.contentsquare.net",
};

const contentSecurityPolicy = [
  "default-src 'self'",
  // 'wasm-unsafe-eval' : compiler le WebAssembly de l'essayage virtuel (MediaPipe, servi par le site).
  // Il n'autorise ni eval() ni new Function().
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""} ${contentsquare.script}`,
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabase} ${contentsquare.img}`,
  `media-src 'self' blob: ${supabase}`,
  `connect-src 'self' ${supabase} ${supabase.replace(/^http/, "ws")}${isDev ? " ws:" : ""} ${contentsquare.connect}`,
  "font-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // La carte de la boutique (OpenStreetMap), chargée seulement quand le client la demande.
  "frame-src https://www.openstreetmap.org",
].join("; ");

// Images : l'optimiseur de Next redimensionne les photos du Storage et les sert en WebP depuis le site.
// Le Storage de Supabase Free ne sait pas redimensionner, et chaque photo envoyée fait jusqu'à 1 600 px.
// Peu de largeurs et une seule qualité : chaque couple (photo, largeur) compte comme une transformation
// dans le quota Vercel. NEXT_PUBLIC_IMAGES_UNOPTIMIZED=1 revient aux fichiers bruts sans redéploiement de code.
const supabaseUrl = supabase ? new URL(supabase) : null;
const localSupabase = supabaseUrl ? ["localhost", "127.0.0.1"].includes(supabaseUrl.hostname) : false;
const images: NextConfig["images"] = {
  unoptimized: process.env.NEXT_PUBLIC_IMAGES_UNOPTIMIZED === "1",
  remotePatterns: supabaseUrl
    ? [
        {
          protocol: supabaseUrl.protocol.replace(":", "") as "http" | "https",
          hostname: supabaseUrl.hostname,
          port: supabaseUrl.port,
          pathname: "/storage/v1/object/public/**",
        },
      ]
    : [],
  deviceSizes: [640, 828, 1200, 1920],
  imageSizes: [96, 256, 384],
  qualities: [70],
  formats: ["image/webp"],
  // Les chemins contiennent un UUID : un fichier ne change jamais, on peut le garder un mois.
  minimumCacheTTL: 2_592_000,
  // Seulement quand le Supabase lui-même tourne sur le poste (développement, tests) : en ligne, l'hôte est public.
  dangerouslyAllowLocalIP: localSupabase,
};

// Banc de test (`pnpm test:app`) : son propre dossier de build et son propre tsconfig. Next n'accepte
// qu'un `next dev` par dossier de build ; le banc peut ainsi tourner à côté du `pnpm dev` habituel.
const testDistDir = process.env.FRIPE_DIST_DIR;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  ...(testDistDir ? { distDir: testDistDir, typescript: { tsconfigPath: "tsconfig.test.json" } } : {}),
  images,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    serverActions: { bodySizeLimit: "4.4mb" },
    // Le cache de build Turbopack, restauré par Vercel d'un déploiement à l'autre, a resservi une
    // feuille de style périmée (règles CSS ajoutées absentes en ligne). Chaque build repart de zéro.
    turbopackFileSystemCacheForBuild: false,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Caméra et micro pour le studio vidéo des vendeurs : ce site seulement, jamais un cadre tiers.
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(self)" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          ...(isStaging ? [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] : []),
          ...(isDev
            ? []
            : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
        ],
      },
    ];
  },
};

export default withSerwist(withNextIntl(nextConfig));
