import { describe, expect, it } from "vitest";
import { directionsLinks, distanceKm, inTunisia, mapEmbedUrl, parseCoordinates, roundCoordinates } from "@/features/shops/location";
import { shopLocationSchema } from "@/features/shops/schemas";

const TUNIS = { latitude: 36.8065, longitude: 10.1815 };

describe("lecture d'une position collée", () => {
  it("coordonnées et liens de carte usuels", () => {
    expect(parseCoordinates("36.8065, 10.1815")).toEqual(TUNIS);
    expect(parseCoordinates("https://www.google.com/maps/place/Fripe/@36.8065,10.1815,17z/data=!3m1")).toEqual(TUNIS);
    expect(parseCoordinates("https://www.google.com/maps/place/X/data=!4m6!3m5!3d36.8065!4d10.1815")).toEqual(TUNIS);
    expect(parseCoordinates("https://maps.google.com/?q=36.8065,10.1815")).toEqual(TUNIS);
    expect(parseCoordinates("https://www.openstreetmap.org/?mlat=36.8065&mlon=10.1815#map=17/36.8065/10.1815")).toEqual(TUNIS);
    expect(parseCoordinates("https://waze.com/ul?ll=36.8065%2C10.1815&navigate=yes")).toEqual(TUNIS);
  });

  it("un lien court ou un texte sans position ne donne rien", () => {
    expect(parseCoordinates("https://maps.app.goo.gl/AbCdEf123")).toBeNull();
    expect(parseCoordinates("Rue de Marseille, Tunis")).toBeNull();
    expect(parseCoordinates("120, 10")).toBeNull();
  });
});

describe("contrôles", () => {
  it("la position doit être en Tunisie : une inversion est détectée", () => {
    expect(inTunisia(TUNIS)).toBe(true);
    expect(inTunisia({ latitude: 10.1815, longitude: 36.8065 })).toBe(false);
  });

  it("le formulaire : adresse obligatoire, position facultative mais complète", () => {
    const base = { addressLine: "12 rue de Marseille", governorateId: "1", cityId: "3" };
    expect(shopLocationSchema.safeParse({ ...base, latitude: "", longitude: "" }).success).toBe(true);
    expect(shopLocationSchema.safeParse({ ...base, latitude: "36.8", longitude: "10.18" }).success).toBe(true);
    const half = shopLocationSchema.safeParse({ ...base, latitude: "36.8", longitude: "" });
    expect(half.success ? null : half.error.issues[0].message).toBe("positionIncomplete");
    const swapped = shopLocationSchema.safeParse({ ...base, latitude: "10.18", longitude: "36.8" });
    expect(swapped.success ? null : swapped.error.issues[0].message).toBe("positionOutsideTunisia");
    expect(shopLocationSchema.safeParse({ ...base, addressLine: "", latitude: "", longitude: "" }).success).toBe(false);
  });

  it("six décimales au plus", () => {
    expect(roundCoordinates({ latitude: 36.80654321, longitude: 10.18151234 })).toEqual({ latitude: 36.806543, longitude: 10.181512 });
  });
});

describe("guidage", () => {
  it("avec une position : itinéraire direct dans Google Maps, Waze et Plans", () => {
    const links = directionsLinks({ coordinates: TUNIS, address: "12 rue de Marseille, Tunis" });
    expect(links.google).toBe("https://www.google.com/maps/dir/?api=1&destination=36.8065,10.1815");
    expect(links.waze).toBe("https://waze.com/ul?ll=36.8065,10.1815&navigate=yes");
    expect(links.apple).toBe("https://maps.apple.com/?daddr=36.8065,10.1815");
  });

  it("sans position : l'adresse écrite, encodée", () => {
    const links = directionsLinks({ coordinates: null, address: "12 rue de Marseille, Tunis" });
    expect(links.google).toContain("destination=12%20rue%20de%20Marseille%2C%20Tunis");
    expect(links.waze).toContain("q=12%20rue%20de%20Marseille");
  });

  it("distance à vol d'oiseau Tunis – Sousse, et carte centrée", () => {
    expect(distanceKm(TUNIS, { latitude: 35.8256, longitude: 10.6084 })).toBeGreaterThan(110);
    expect(distanceKm(TUNIS, { latitude: 35.8256, longitude: 10.6084 })).toBeLessThan(120);
    expect(mapEmbedUrl(TUNIS)).toContain("marker=36.8065,10.1815");
  });
});
