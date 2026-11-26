// La règle de modération des médias, sans réseau ni base : testable telle quelle.
//
// Ce que l'on sait faire, et ce que l'on ne prétend pas faire :
// - Le contenu sexuel est jugé par un classifieur d'images (fournisseur externe, voir providers/).
//   Ses scores sont des probabilités : un seuil départage, il peut se tromper dans les deux sens.
// - La génération par IA n'est jamais « certaine ». Deux indices seulement : une provenance déclarée
//   dans le fichier (C2PA, IPTC, logiciel générateur), qui disparaît dès que l'image est réencodée,
//   et le score d'un détecteur statistique. Ils servent à signaler aux administrateurs, pas à punir.
// - Un contenu interdit reste interdit, qu'il soit photographié ou généré : l'IA n'excuse rien.

export type MediaKind = "image" | "video";
export type MediaContext = "product_image" | "listing_image" | "shop_logo" | "shop_video" | "video_thumbnail";

// Probabilités de 0 à 1, au sens du modèle nudity-2.1 (le plus fin des classifieurs disponibles).
export type NudityScores = {
  sexualActivity: number;
  sexualDisplay: number;
  erotica: number;
  verySuggestive: number;
};

export type AiSignal =
  | { source: "provenance"; marker: string; detail: string }
  | { source: "detector"; score: number };

export type ProviderAnalysis = {
  provider: string;
  nudity: NudityScores | null;
  aiGenerated: number | null;
};

export type ViolationCategory = "sexual_explicit" | "sexual_erotica" | "sexual_suggestive" | "ai_generated";
export type Severity = "low" | "medium" | "high" | "critical";

export type Verdict =
  | { decision: "allow" }
  | {
      decision: "block" | "flag";
      category: ViolationCategory;
      severity: Severity;
      reason: string;
      aiSuspected: boolean;
    };

// Seuils retenus. Une pièce de lingerie ou un maillot portés restent « suggestifs » : ils ne sont
// jamais bloqués, seulement signalés au-delà du seuil haut, pour ne pas pénaliser les vendeurs.
export const THRESHOLDS = {
  explicitCritical: 0.85,
  explicit: 0.5,
  erotica: 0.5,
  verySuggestiveFlag: 0.85,
  aiDetector: 0.9,
} as const;

export function aiSuspected(signals: AiSignal[]) {
  return signals.some((signal) => signal.source === "provenance" || signal.score >= THRESHOLDS.aiDetector);
}

export function aiSignalsFrom(analysis: ProviderAnalysis | null, provenance: AiSignal[]): AiSignal[] {
  const detector: AiSignal[] =
    analysis?.aiGenerated != null ? [{ source: "detector", score: round(analysis.aiGenerated) }] : [];
  return [...provenance, ...detector];
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function decide(analysis: ProviderAnalysis | null, signals: AiSignal[]): Verdict {
  const ai = aiSuspected(signals);
  const aiNote = ai ? " Indices de génération ou de retouche par IA relevés." : "";
  const nudity = analysis?.nudity;

  if (nudity) {
    const explicit = Math.max(nudity.sexualActivity, nudity.sexualDisplay);

    if (explicit >= THRESHOLDS.explicit) {
      const critical = explicit >= THRESHOLDS.explicitCritical;
      return {
        decision: "block",
        category: "sexual_explicit",
        severity: critical ? "critical" : "high",
        reason: `Contenu sexuel explicite ou pornographique (score ${round(explicit)}).${aiNote}`,
        aiSuspected: ai,
      };
    }

    if (nudity.erotica >= THRESHOLDS.erotica) {
      return {
        decision: "block",
        category: "sexual_erotica",
        severity: "medium",
        reason: `Nudité ou contenu érotique réservé aux adultes (+18, score ${round(nudity.erotica)}).${aiNote}`,
        aiSuspected: ai,
      };
    }

    if (nudity.verySuggestive >= THRESHOLDS.verySuggestiveFlag) {
      return {
        decision: "flag",
        category: "sexual_suggestive",
        severity: "low",
        reason: `Image très suggestive publiée, à vérifier (score ${round(nudity.verySuggestive)}).${aiNote}`,
        aiSuspected: ai,
      };
    }
  }

  if (ai) {
    return {
      decision: "flag",
      category: "ai_generated",
      severity: "low",
      reason: describeAi(signals),
      aiSuspected: true,
    };
  }

  return { decision: "allow" };
}

function describeAi(signals: AiSignal[]) {
  const parts = signals.flatMap((signal) =>
    signal.source === "provenance"
      ? [`provenance déclarée dans le fichier (${signal.detail})`]
      : signal.score >= THRESHOLDS.aiDetector
        ? [`détecteur statistique, score ${signal.score}`]
        : [],
  );
  return `Image ou vidéo probablement générée ou retouchée par IA : ${parts.join(" ; ")}. Indice, pas une certitude.`;
}

// Le pire verdict l'emporte : une vidéo est bloquée si sa vidéo ou sa miniature l'est.
const RANK = { allow: 0, flag: 1, block: 2 } as const;
const SEVERITY_RANK: Record<Severity, number> = { low: 0, medium: 1, high: 2, critical: 3 };

export function worst(verdicts: Verdict[]): Verdict {
  return verdicts.reduce<Verdict>((current, next) => {
    if (RANK[next.decision] !== RANK[current.decision]) return RANK[next.decision] > RANK[current.decision] ? next : current;
    if (next.decision === "allow" || current.decision === "allow") return current;
    return SEVERITY_RANK[next.severity] > SEVERITY_RANK[current.severity] ? next : current;
  }, { decision: "allow" });
}

// La sanction prévue, rappelée dans l'interface ; la base l'applique (record_media_moderation).
//   critique (explicite, score ≥ 0,85) : suspension immédiate ;
//   élevée (explicite, score ≥ 0,5)    : suspension à la 2e tentative en 30 jours ;
//   moyenne (érotique, +18)            : suspension à la 3e tentative en 30 jours.
export const SUSPENSION_AFTER: Record<Severity, number | null> = { critical: 1, high: 2, medium: 3, low: null };
