// La localisation d'une boutique : lire une position (coordonnées ou lien de carte), construire les
// liens de guidage vers les applications de navigation, mesurer une distance. Sans service externe :
// rien n'est envoyé, les liens ouvrent simplement l'application choisie par le client.

export type Coordinates = { latitude: number; longitude: number };

// La Tunisie, large : une position hors de ce cadre est presque toujours une erreur de saisie
// (latitude et longitude inversées, signe oublié).
const TUNISIA = { south: 30, north: 37.7, west: 7.4, east: 11.8 };

export function inTunisia({ latitude, longitude }: Coordinates) {
  return latitude >= TUNISIA.south && latitude <= TUNISIA.north && longitude >= TUNISIA.west && longitude <= TUNISIA.east;
}

const NUMBER = "(-?\\d{1,3}(?:\\.\\d+)?)";

// Une position collée par le vendeur : « 36.8065, 10.1815 », un lien Google Maps (…/@36.8,10.18,17z,
// ?q=36.8,10.18, !3d36.8!4d10.18), OpenStreetMap (?mlat=…&mlon=… ou #map=17/36.8/10.18), Waze (?ll=…).
// Les liens courts (maps.app.goo.gl) ne contiennent pas la position : null.
export function parseCoordinates(text: string): Coordinates | null {
  const value = text.trim();
  const patterns = [
    new RegExp(`!3d${NUMBER}!4d${NUMBER}`),
    new RegExp(`@${NUMBER},${NUMBER}`),
    new RegExp(`[?&](?:q|ll|query|destination|daddr|sll)=${NUMBER}(?:,|%2C)\\s*${NUMBER}`, "i"),
    new RegExp(`[?&]mlat=${NUMBER}&mlon=${NUMBER}`),
    new RegExp(`#map=\\d+/${NUMBER}/${NUMBER}`),
    new RegExp(`^${NUMBER}\\s*[,; ]\\s*${NUMBER}$`),
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (!match) continue;
    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    if (Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) return { latitude, longitude };
  }
  return null;
}

// Six décimales : la précision de la colonne (une dizaine de centimètres), rien de plus.
export function roundCoordinates({ latitude, longitude }: Coordinates): Coordinates {
  return { latitude: Math.round(latitude * 1e6) / 1e6, longitude: Math.round(longitude * 1e6) / 1e6 };
}

// Les liens de guidage. Avec une position : itinéraire direct vers le point. Sans position : recherche
// de l'adresse écrite, que l'application de navigation sait interpréter.
export function directionsLinks(target: { coordinates: Coordinates | null; address: string }) {
  const { coordinates, address } = target;
  const point = coordinates ? `${coordinates.latitude},${coordinates.longitude}` : null;
  const query = encodeURIComponent(address);
  return {
    google: point
      ? `https://www.google.com/maps/dir/?api=1&destination=${point}`
      : `https://www.google.com/maps/dir/?api=1&destination=${query}`,
    waze: point ? `https://waze.com/ul?ll=${point}&navigate=yes` : `https://waze.com/ul?q=${query}&navigate=yes`,
    apple: point ? `https://maps.apple.com/?daddr=${point}` : `https://maps.apple.com/?daddr=${query}`,
  };
}

// La carte OpenStreetMap intégrée, centrée sur la boutique, avec son repère.
export function mapEmbedUrl({ latitude, longitude }: Coordinates, span = 0.006) {
  const box = [longitude - span, latitude - span * 0.7, longitude + span, latitude + span * 0.7].map((value) => value.toFixed(6)).join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${box}&layer=mapnik&marker=${latitude},${longitude}`;
}

export function mapPageUrl({ latitude, longitude }: Coordinates) {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`;
}

// Distance à vol d'oiseau, en kilomètres (formule de haversine).
export function distanceKm(a: Coordinates, b: Coordinates) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
