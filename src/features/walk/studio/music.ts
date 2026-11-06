"use client";

// Musiques de fond composées par le code, dans le navigateur : aucun fichier, aucun droit d'auteur
// à vérifier. Chaque ambiance est une boucle courte, rendue hors ligne à la durée exacte de la vidéo.

export const TRACKS = ["portant", "souk", "defile", "plage"] as const;
export type TrackId = (typeof TRACKS)[number];

const SAMPLE_RATE = 44100;
const midi = (note: number) => 440 * 2 ** ((note - 69) / 12);

type Ctx = OfflineAudioContext;

function noiseBuffer(ctx: Ctx) {
  const buffer = ctx.createBuffer(1, SAMPLE_RATE, SAMPLE_RATE);
  const data = buffer.getChannelData(0);
  // Bruit pseudo-aléatoire déterministe : la même musique à chaque rendu.
  let seed = 7;
  for (let i = 0; i < data.length; i++) {
    seed = (seed * 16807) % 2147483647;
    data[i] = (seed / 2147483647) * 2 - 1;
  }
  return buffer;
}

function tone(
  ctx: Ctx,
  out: AudioNode,
  options: { freq: number; start: number; dur: number; type?: OscillatorType; gain?: number; attack?: number; cutoff?: number; detune?: number },
) {
  const { freq, start, dur, type = "sine", gain = 0.2, attack = 0.01, cutoff, detune = 0 } = options;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;
  amp.gain.setValueAtTime(0, start);
  amp.gain.linearRampToValueAtTime(gain, start + attack);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + dur);

  let node: AudioNode = osc;
  if (cutoff) {
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    osc.connect(filter);
    node = filter;
  }
  node.connect(amp).connect(out);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

function kick(ctx: Ctx, out: AudioNode, start: number, gain = 0.9) {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.frequency.setValueAtTime(150, start);
  osc.frequency.exponentialRampToValueAtTime(45, start + 0.12);
  amp.gain.setValueAtTime(gain, start);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
  osc.connect(amp).connect(out);
  osc.start(start);
  osc.stop(start + 0.4);
}

function hit(ctx: Ctx, out: AudioNode, noise: AudioBuffer, start: number, options: { dur: number; freq: number; gain: number; type?: BiquadFilterType }) {
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const amp = ctx.createGain();
  source.buffer = noise;
  filter.type = options.type ?? "highpass";
  filter.frequency.value = options.freq;
  amp.gain.setValueAtTime(options.gain, start);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + options.dur);
  source.connect(filter).connect(amp).connect(out);
  source.start(start, (start * 0.37) % 0.5);
  source.stop(start + options.dur + 0.02);
}

// Chaque ambiance écrit une mesure ; la boucle couvre toute la durée.
const WRITERS: Record<TrackId, { bpm: number; bar: (ctx: Ctx, out: AudioNode, noise: AudioBuffer, t: number, beat: number, index: number) => void }> = {
  // Lo-fi doux : accords de septième feutrés, grosse caisse légère.
  portant: {
    bpm: 80,
    bar(ctx, out, noise, t, beat, index) {
      const chords = [[57, 60, 64, 67], [50, 57, 60, 65], [55, 59, 62, 65], [48, 55, 59, 64]];
      for (const note of chords[index % 4]) tone(ctx, out, { freq: midi(note), start: t, dur: beat * 4, type: "triangle", gain: 0.05, attack: 0.3, cutoff: 1400 });
      tone(ctx, out, { freq: midi(chords[index % 4][0] - 12), start: t, dur: beat * 2, type: "sine", gain: 0.16, attack: 0.02 });
      kick(ctx, out, t, 0.5);
      kick(ctx, out, t + beat * 2.5, 0.35);
      hit(ctx, out, noise, t + beat, { dur: 0.18, freq: 1800, gain: 0.12, type: "bandpass" });
      hit(ctx, out, noise, t + beat * 3, { dur: 0.18, freq: 1800, gain: 0.12, type: "bandpass" });
      for (let i = 0; i < 8; i++) hit(ctx, out, noise, t + (beat / 2) * i, { dur: 0.04, freq: 7000, gain: 0.03 });
    },
  },
  // Percussions du souk : doum et tek, basse sur un mode oriental.
  souk: {
    bpm: 100,
    bar(ctx, out, noise, t, beat, index) {
      const doum = (at: number) => tone(ctx, out, { freq: 95, start: at, dur: 0.3, gain: 0.5, attack: 0.003 });
      const tek = (at: number, gain = 0.16) => hit(ctx, out, noise, at, { dur: 0.06, freq: 3500, gain });
      doum(t);
      tek(t + beat);
      tek(t + beat * 1.5, 0.09);
      doum(t + beat * 2);
      tek(t + beat * 3);
      tek(t + beat * 3.5, 0.09);
      const riff = [62, 63, 66, 67, 69, 67, 66, 63];
      riff.forEach((note, i) => {
        if (i % 2 === index % 2) tone(ctx, out, { freq: midi(note), start: t + (beat / 2) * i, dur: beat / 2, type: "sawtooth", gain: 0.05, cutoff: 1800 });
      });
      tone(ctx, out, { freq: midi(38), start: t, dur: beat * 4, type: "triangle", gain: 0.12, attack: 0.05 });
    },
  },
  // Défilé : quatre temps, charleston à contretemps, basse en octaves.
  defile: {
    bpm: 120,
    bar(ctx, out, noise, t, beat, index) {
      const roots = [45, 45, 41, 43];
      for (let i = 0; i < 4; i++) {
        kick(ctx, out, t + beat * i, 0.8);
        hit(ctx, out, noise, t + beat * i + beat / 2, { dur: 0.07, freq: 8000, gain: 0.07 });
        tone(ctx, out, { freq: midi(roots[index % 4] + (i % 2 ? 12 : 0)), start: t + beat * i + beat / 2, dur: beat / 2, type: "sawtooth", gain: 0.08, cutoff: 900 });
      }
      hit(ctx, out, noise, t + beat, { dur: 0.15, freq: 2000, gain: 0.1, type: "bandpass" });
      hit(ctx, out, noise, t + beat * 3, { dur: 0.15, freq: 2000, gain: 0.1, type: "bandpass" });
      for (const note of [roots[index % 4] + 24, roots[index % 4] + 28, roots[index % 4] + 31]) {
        tone(ctx, out, { freq: midi(note), start: t + beat * 1.5, dur: 0.25, type: "square", gain: 0.025, cutoff: 2500 });
      }
    },
  },
  // Plage : nappe lente et arpège léger, sans batterie.
  plage: {
    bpm: 70,
    bar(ctx, out, _noise, t, beat, index) {
      const chords = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]];
      const chord = chords[index % 4];
      for (const note of chord) {
        tone(ctx, out, { freq: midi(note), start: t, dur: beat * 4.2, gain: 0.04, attack: 0.8, detune: -6 });
        tone(ctx, out, { freq: midi(note), start: t, dur: beat * 4.2, gain: 0.04, attack: 0.8, detune: 6 });
      }
      [0, 1, 2, 3, 2, 1, 2, 3].forEach((step, i) =>
        tone(ctx, out, { freq: midi(chord[step] + 12), start: t + (beat / 2) * i, dur: 0.6, type: "triangle", gain: 0.06 }),
      );
    },
  },
};

export async function renderTrack(id: TrackId, seconds: number) {
  const length = Math.ceil(Math.max(1, seconds) * SAMPLE_RATE);
  const ctx = new OfflineAudioContext(2, length, SAMPLE_RATE);
  const master = ctx.createGain();
  const compressor = ctx.createDynamicsCompressor();
  master.gain.value = 0.9;
  master.connect(compressor).connect(ctx.destination);

  const noise = noiseBuffer(ctx);
  const { bpm, bar } = WRITERS[id];
  const beat = 60 / bpm;
  for (let index = 0, t = 0; t < seconds; index++, t += beat * 4) bar(ctx, master, noise, t, beat, index);

  // Fondu de sortie sur la dernière seconde.
  master.gain.setValueAtTime(0.9, Math.max(0, seconds - 1));
  master.gain.linearRampToValueAtTime(0, seconds);

  return ctx.startRendering();
}
