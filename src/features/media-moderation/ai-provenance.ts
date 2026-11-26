import type { AiSignal } from "./policy";

// Indices de génération par IA déclarés dans le fichier lui-même : la norme IPTC « digital source type »
// (reprise par les manifestes C2PA / Content Credentials) et la signature des logiciels générateurs
// (champ Software, XMP, blocs texte PNG). Ce sont des déclarations, faciles à effacer : une capture
// d'écran ou un simple réencodage (la compression faite par le navigateur avant envoi, par exemple)
// les fait disparaître. Leur absence ne prouve donc rien ; leur présence est un indice sérieux.
const MARKERS: { marker: string; pattern: string; detail: string }[] = [
  { marker: "iptc_trained_algorithmic_media", pattern: "compositeWithTrainedAlgorithmicMedia", detail: "IPTC : retouché avec une IA générative" },
  { marker: "iptc_trained_algorithmic_media", pattern: "trainedAlgorithmicMedia", detail: "IPTC : généré par une IA" },
  { marker: "iptc_algorithmic_media", pattern: "digitalsourcetype/algorithmicMedia", detail: "IPTC : média algorithmique" },
  { marker: "generator", pattern: "Midjourney", detail: "Midjourney" },
  { marker: "generator", pattern: "DALL-E", detail: "DALL·E" },
  { marker: "generator", pattern: "DALLÂ·E", detail: "DALL·E" },
  { marker: "generator", pattern: "Stable Diffusion", detail: "Stable Diffusion" },
  { marker: "generator", pattern: "stable-diffusion", detail: "Stable Diffusion" },
  { marker: "generator", pattern: "Adobe Firefly", detail: "Adobe Firefly" },
  { marker: "generator", pattern: "NovelAI", detail: "NovelAI" },
  { marker: "generator", pattern: "ComfyUI", detail: "ComfyUI" },
  { marker: "generator", pattern: "InvokeAI", detail: "InvokeAI" },
  { marker: "generator", pattern: "Leonardo.Ai", detail: "Leonardo.Ai" },
];

// Les paramètres de génération qu'écrit l'interface AUTOMATIC1111 dans un bloc texte PNG.
const SD_PARAMETERS = /parameters\0[\s\S]{0,4000}?Steps: \d+, Sampler: /;

// Les métadonnées sont en tête de fichier (EXIF, XMP, blocs PNG) ou, pour certaines vidéos, en fin.
const WINDOW = 512 * 1024;

export function detectAiProvenance(bytes: Uint8Array): AiSignal[] {
  const head = latin1(bytes.subarray(0, WINDOW));
  const tail = bytes.length > WINDOW ? latin1(bytes.subarray(Math.max(WINDOW, bytes.length - WINDOW))) : "";
  const text = head + tail;
  const signals: AiSignal[] = [];
  const seen = new Set<string>();

  for (const { marker, pattern, detail } of MARKERS) {
    if (seen.has(detail) || !text.includes(pattern)) continue;
    // « trainedAlgorithmicMedia » est contenu dans « compositeWith… » : une seule mention suffit.
    if (pattern === "trainedAlgorithmicMedia" && seen.has("IPTC : retouché avec une IA générative")) continue;
    seen.add(detail);
    signals.push({ source: "provenance", marker, detail });
  }

  if (SD_PARAMETERS.test(text) && !seen.has("Stable Diffusion")) {
    signals.push({ source: "provenance", marker: "generator", detail: "Stable Diffusion (paramètres de génération)" });
  }

  return signals;
}

function latin1(bytes: Uint8Array) {
  let out = "";
  for (let index = 0; index < bytes.length; index += 8192) {
    out += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }
  return out;
}
