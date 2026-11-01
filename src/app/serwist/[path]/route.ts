import { createSerwistRoute } from "@serwist/turbopack";

const revision = process.env.NEXT_PUBLIC_BUILD_ID ?? crypto.randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  additionalPrecacheEntries: [
    { url: "/hors-ligne", revision },
    { url: "/ar/hors-ligne", revision },
  ],
  swSrc: "src/app/sw.ts",
  useNativeEsbuild: true,
});
