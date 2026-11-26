import { describe, expect, it, vi } from "vitest";
import { detectAiProvenance } from "@/features/media-moderation/ai-provenance";
import { evaluateMedia, runModeration, type ModerationEvent } from "@/features/media-moderation/evaluate";
import { decide, worst, type ProviderAnalysis, type Verdict } from "@/features/media-moderation/policy";
import {
  fixtureProvider,
  getModerationProvider,
  mergeAnalyses,
  ProviderError,
  type ModerationProvider,
} from "@/features/media-moderation/providers";

const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const bytes = (...parts: (string | number[])[]) =>
  new Uint8Array(parts.flatMap((part) => (typeof part === "string" ? [...new TextEncoder().encode(part)] : part)));

const analysis = (nudity: Partial<NonNullable<ProviderAnalysis["nudity"]>>, aiGenerated: number | null = 0.01): ProviderAnalysis => ({
  provider: "test",
  nudity: { sexualActivity: 0, sexualDisplay: 0, erotica: 0, verySuggestive: 0, ...nudity },
  aiGenerated,
});

function providerReturning(result: ProviderAnalysis | Error): ModerationProvider {
  const analyze = vi.fn(async () => {
    if (result instanceof Error) throw result;
    return result;
  });
  return { name: "test", analyzeImage: analyze, analyzeVideo: analyze };
}

const image = (content = "photo") => ({ bytes: bytes(JPEG, content), mime: "image/jpeg", kind: "image" as const });
const base = { userId: "00000000-0000-0000-0000-000000000001", context: "product_image" as const, mediaKind: "image" as const };

describe("règle de modération", () => {
  it("laisse passer une photo ordinaire, lingerie et maillots compris", () => {
    expect(decide(analysis({}), [])).toEqual({ decision: "allow" });
    expect(decide(analysis({ verySuggestive: 0.6 }), [])).toEqual({ decision: "allow" });
  });

  it("bloque le contenu sexuel explicite, critique au-delà de 0,85", () => {
    const critical = decide(analysis({ sexualActivity: 0.97 }), []);
    expect(critical).toMatchObject({ decision: "block", category: "sexual_explicit", severity: "critical" });

    const high = decide(analysis({ sexualDisplay: 0.6 }), []);
    expect(high).toMatchObject({ decision: "block", category: "sexual_explicit", severity: "high" });
  });

  it("bloque la nudité érotique (+18) avec une gravité moyenne", () => {
    expect(decide(analysis({ erotica: 0.7 }), [])).toMatchObject({ decision: "block", category: "sexual_erotica", severity: "medium" });
  });

  it("signale sans bloquer une image très suggestive", () => {
    expect(decide(analysis({ verySuggestive: 0.9 }), [])).toMatchObject({ decision: "flag", category: "sexual_suggestive", severity: "low" });
  });

  it("un contenu interdit reste bloqué même généré par IA, et l'indice figure au rapport", () => {
    const verdict = decide(analysis({ sexualActivity: 0.99 }, 0.99), [{ source: "detector", score: 0.99 }]);
    expect(verdict).toMatchObject({ decision: "block", category: "sexual_explicit", aiSuspected: true });
    expect(verdict.decision !== "allow" && verdict.reason).toContain("IA");
  });

  it("une image générée par IA mais sans contenu interdit est signalée, jamais bloquée ni sanctionnée", () => {
    const verdict = decide(analysis({}, 0.95), [{ source: "detector", score: 0.95 }]);
    expect(verdict).toMatchObject({ decision: "flag", category: "ai_generated", severity: "low" });
    expect(verdict.decision !== "allow" && verdict.reason).toMatch(/pas une certitude/);
  });

  it("un score de détecteur IA modéré ne déclenche rien", () => {
    expect(decide(analysis({}, 0.6), [{ source: "detector", score: 0.6 }])).toEqual({ decision: "allow" });
  });

  it("sans fournisseur, seule une provenance IA déclarée est relevée", () => {
    expect(decide(null, [])).toEqual({ decision: "allow" });
    expect(decide(null, [{ source: "provenance", marker: "generator", detail: "Midjourney" }])).toMatchObject({ decision: "flag", category: "ai_generated" });
  });

  it("garde le pire verdict entre la vidéo et sa miniature", () => {
    const flag: Verdict = { decision: "flag", category: "ai_generated", severity: "low", reason: "r", aiSuspected: true };
    const medium: Verdict = { decision: "block", category: "sexual_erotica", severity: "medium", reason: "r", aiSuspected: false };
    const critical: Verdict = { decision: "block", category: "sexual_explicit", severity: "critical", reason: "r", aiSuspected: false };
    expect(worst([{ decision: "allow" }, flag])).toBe(flag);
    expect(worst([medium, flag, critical])).toBe(critical);
    expect(worst([])).toEqual({ decision: "allow" });
  });
});

describe("provenance IA déclarée", () => {
  it("lit le type de source IPTC des Content Credentials", () => {
    const signals = detectAiProvenance(bytes(JPEG, "<x:xmpmeta>http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia</x:xmpmeta>"));
    expect(signals).toEqual([{ source: "provenance", marker: "iptc_trained_algorithmic_media", detail: "IPTC : généré par une IA" }]);
  });

  it("distingue une retouche par IA d'une génération complète", () => {
    const signals = detectAiProvenance(bytes(JPEG, "digitalsourcetype/compositeWithTrainedAlgorithmicMedia"));
    expect(signals.map((signal) => signal.source === "provenance" && signal.detail)).toEqual(["IPTC : retouché avec une IA générative"]);
  });

  it("reconnaît la signature d'un générateur et les paramètres Stable Diffusion", () => {
    expect(detectAiProvenance(bytes(JPEG, "Software\0Midjourney v6"))).toHaveLength(1);
    const png = bytes([0x89, 0x50, 0x4e, 0x47], "tEXtparameters\0a red dress\nSteps: 30, Sampler: Euler a, CFG scale: 7");
    expect(detectAiProvenance(png)).toEqual([{ source: "provenance", marker: "generator", detail: "Stable Diffusion (paramètres de génération)" }]);
  });

  it("ne signale rien sur une photo sans métadonnée d'IA", () => {
    expect(detectAiProvenance(bytes(JPEG, "Exif\0\0Canon EOS 2000D"))).toEqual([]);
  });
});

describe("fournisseurs", () => {
  it("garde le pire score de chaque image d'une vidéo", () => {
    const merged = mergeAnalyses("sightengine", [
      { nudity: { sexual_activity: 0.1, erotica: 0.7 }, type: { ai_generated: 0.2 } },
      { nudity: { sexual_activity: 0.9 }, type: { ai_generated: 0.4 } },
    ]);
    expect(merged).toEqual({
      provider: "sightengine",
      nudity: { sexualActivity: 0.9, sexualDisplay: 0, erotica: 0.7, verySuggestive: 0 },
      aiGenerated: 0.4,
    });
  });

  it("le fournisseur de test lit le marqueur posé dans le fichier", async () => {
    const provider = fixtureProvider();
    await expect(provider.analyzeImage(bytes(JPEG, "FRIPE-MODERATION-TEST:explicit-critical"), "image/jpeg")).resolves.toMatchObject({ nudity: { sexualActivity: 0.97 } });
    await expect(provider.analyzeImage(bytes(JPEG, "FRIPE-MODERATION-TEST:unavailable"), "image/jpeg")).rejects.toBeInstanceOf(ProviderError);
  });

  it("le fournisseur de test est refusé hors du stack de test", () => {
    expect(() => getModerationProvider({ MEDIA_MODERATION_PROVIDER: "fixture", NODE_ENV: "production" })).toThrow(ProviderError);
    expect(() => getModerationProvider({ MEDIA_MODERATION_PROVIDER: "fixture", FRIPE_E2E: "1", NEXT_PUBLIC_FRIPE_ENV: "production" })).toThrow(ProviderError);
    expect(getModerationProvider({ MEDIA_MODERATION_PROVIDER: "fixture", FRIPE_E2E: "1" })?.name).toBe("fixture");
  });

  it("Sightengine s'active avec ses deux clés, rien sans elles", () => {
    expect(getModerationProvider({})).toBeNull();
    expect(getModerationProvider({ SIGHTENGINE_API_USER: "u" })).toBeNull();
    expect(getModerationProvider({ SIGHTENGINE_API_USER: "u", SIGHTENGINE_API_SECRET: "s" })?.name).toBe("sightengine");
    expect(getModerationProvider({ MEDIA_MODERATION_PROVIDER: "none", SIGHTENGINE_API_USER: "u", SIGHTENGINE_API_SECRET: "s" })).toBeNull();
  });
});

describe("chaîne de modération d'un envoi", () => {
  const record = () => vi.fn(async (event: ModerationEvent) => ({ suspended: event.severity === "critical" }));

  it("une photo saine passe sans rapport", async () => {
    const recordEvent = record();
    const outcome = await runModeration({ ...base, parts: [image()] }, { provider: providerReturning(analysis({})), required: true, record: recordEvent });
    expect(outcome).toEqual({ ok: true, flagged: false });
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("bloque, rapporte au serveur et annonce la suspension", async () => {
    const recordEvent = record();
    const outcome = await runModeration({ ...base, parts: [image()] }, { provider: providerReturning(analysis({ sexualActivity: 0.98 })), required: true, record: recordEvent });

    expect(outcome).toEqual({ ok: false, error: "media_blocked_suspended" });
    const event = recordEvent.mock.calls[0][0];
    expect(event).toMatchObject({ userId: base.userId, context: "product_image", decision: "block", category: "sexual_explicit", severity: "critical", provider: "test" });
    expect(event.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(event.reason).toMatch(/explicite/);
  });

  it("bloque sans suspendre à la première tentative moins grave", async () => {
    const outcome = await runModeration({ ...base, parts: [image()] }, { provider: providerReturning(analysis({ erotica: 0.8 })), required: true, record: record() });
    expect(outcome).toEqual({ ok: false, error: "media_blocked" });
  });

  it("le blocage tient même si le rapport n'a pas pu être enregistré", async () => {
    const log = vi.fn();
    const outcome = await runModeration(
      { ...base, parts: [image()] },
      { provider: providerReturning(analysis({ sexualDisplay: 0.9 })), required: true, record: async () => Promise.reject(new Error("base")), log },
    );
    expect(outcome).toEqual({ ok: false, error: "media_blocked" });
    expect(log).toHaveBeenCalled();
  });

  it("une panne du service d'analyse refuse l'envoi (pas de publication sans vérification)", async () => {
    const outcome = await runModeration({ ...base, parts: [image()] }, { provider: providerReturning(new ProviderError("panne")), required: false, record: record(), log: vi.fn() });
    expect(outcome).toEqual({ ok: false, error: "moderation_unavailable" });
  });

  it("modération exigée sans service configuré : l'envoi est refusé", async () => {
    const outcome = await runModeration({ ...base, parts: [image()] }, { provider: null, required: true, record: record(), log: vi.fn() });
    expect(outcome).toEqual({ ok: false, error: "moderation_unavailable" });
  });

  it("un indice d'IA est rapporté aux administrateurs mais l'envoi passe", async () => {
    const recordEvent = record();
    const outcome = await runModeration({ ...base, parts: [image("Midjourney")] }, { provider: null, required: false, record: recordEvent });
    expect(outcome).toEqual({ ok: true, flagged: true });
    expect(recordEvent.mock.calls[0][0]).toMatchObject({ decision: "flag", category: "ai_generated", provider: "provenance" });
  });

  it("une vidéo est bloquée si sa miniature l'est", async () => {
    const provider: ModerationProvider = {
      name: "test",
      analyzeVideo: async () => analysis({}),
      analyzeImage: async () => analysis({ sexualActivity: 0.9 }),
    };
    const result = await evaluateMedia(
      [
        { bytes: bytes("....ftypmp42"), mime: "video/mp4", kind: "video" },
        image(),
      ],
      provider,
    );
    expect(result.verdict).toMatchObject({ decision: "block", category: "sexual_explicit" });
    expect(result.analyses.map((entry) => entry.kind)).toEqual(["video", "image"]);
  });
});
