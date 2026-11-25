import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Friptex",
    short_name: "Friptex",
    description: "La marketplace de fripe en Tunisie.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f9f6f1",
    theme_color: "#c23f28",
    lang: "fr",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
