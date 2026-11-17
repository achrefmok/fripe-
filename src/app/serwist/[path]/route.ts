import { createSerwistRoute } from "@serwist/turbopack";

const revision = process.env.NEXT_PUBLIC_BUILD_ID ?? crypto.randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  additionalPrecacheEntries: [
    { url: "/hors-ligne", revision },
    { url: "/ar/hors-ligne", revision },
  ],
  swSrc: "src/app/sw.ts",
  // L'essayage virtuel (20 Mo de modèle et de WebAssembly) ne se charge qu'à la demande : jamais
  // dans le cache hors ligne de tous les visiteurs.
  globIgnores: ["**/node_modules/**/*", "public/mediapipe/**/*"],
  useNativeEsbuild: true,
});
