import type { MetadataRoute } from "next";

// La préproduction ne doit jamais apparaître dans un moteur de recherche.
export default function robots(): MetadataRoute.Robots {
  return process.env.NEXT_PUBLIC_FRIPE_ENV === "staging"
    ? { rules: { userAgent: "*", disallow: "/" } }
    : { rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/vendeur", "/compte", "/api"] } };
}
