"use client";

import { recorderType } from "../video-file";

// Le montage du studio : la vidéo filmée, une musique, une voix et des textes, mélangés dans le
// navigateur. L'aperçu et le rendu final passent par le même dessin et le même mélange.

export type Overlay = { caption: string; productName: string; price: string; showProduct: boolean };
export type Volumes = { original: number; music: number; voice: number };

const MAX_LONG_SIDE = 1280;
const ARABIC = /[؀-ۿ]/;

export function studioSupported() {
  if (typeof window === "undefined") return false;
  return (
    typeof MediaRecorder !== "undefined" &&
    typeof AudioContext !== "undefined" &&
    "captureStream" in HTMLCanvasElement.prototype &&
    recorderType() !== null
  );
}

function wrap(context: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines.slice(0, maxLines);
}

// Les textes posés sur l'image : la légende en haut, l'étiquette nom et prix en bas.
export function drawOverlay(context: CanvasRenderingContext2D, width: number, height: number, overlay: Overlay, font: string) {
  const unit = Math.min(width, height) / 20;

  if (overlay.caption.trim()) {
    context.font = `800 ${Math.round(unit * 1.25)}px ${font}`;
    context.direction = ARABIC.test(overlay.caption) ? "rtl" : "ltr";
    context.textAlign = "center";
    context.textBaseline = "middle";
    const lines = wrap(context, overlay.caption.trim(), width * 0.84, 2);
    const lineHeight = unit * 1.6;
    const top = unit * 1.6;
    context.fillStyle = "rgba(29, 26, 23, 0.62)";
    context.fillRect(width * 0.05, top - unit * 0.9, width * 0.9, lineHeight * lines.length + unit * 0.5);
    context.fillStyle = "#f7f4ec";
    lines.forEach((text, index) => context.fillText(text, width / 2, top + lineHeight * index + unit * 0.3));
  }

  if (overlay.showProduct && (overlay.productName.trim() || overlay.price.trim())) {
    const name = overlay.productName.trim();
    const rtl = ARABIC.test(name);
    context.direction = rtl ? "rtl" : "ltr";
    context.textAlign = rtl ? "right" : "left";
    context.textBaseline = "alphabetic";
    const padding = unit * 0.7;
    const x = rtl ? width - unit * 1.2 : unit * 1.2;
    const bottom = height - unit * 2.2;

    context.font = `700 ${Math.round(unit * 0.95)}px ${font}`;
    const nameLines = name ? wrap(context, name, width * 0.7, 2) : [];
    context.font = `800 ${Math.round(unit * 1.5)}px ${font}`;
    const priceWidth = context.measureText(overlay.price).width;
    context.font = `700 ${Math.round(unit * 0.95)}px ${font}`;
    const nameWidth = Math.max(0, ...nameLines.map((text) => context.measureText(text).width));
    const boxWidth = Math.max(nameWidth, priceWidth) + padding * 2;
    const boxHeight = nameLines.length * unit * 1.25 + (overlay.price ? unit * 1.9 : 0) + padding * 1.2;
    const left = rtl ? x - boxWidth : x;

    context.fillStyle = "#c8352a";
    context.fillRect(left, bottom - boxHeight, boxWidth, boxHeight);
    context.fillStyle = "#f7f4ec";
    const textX = rtl ? left + boxWidth - padding : left + padding;
    nameLines.forEach((text, index) => context.fillText(text, textX, bottom - boxHeight + padding + unit * (index + 0.95) * 1.25 - unit * 0.25));
    if (overlay.price) {
      context.font = `800 ${Math.round(unit * 1.5)}px ${font}`;
      context.fillText(overlay.price, textX, bottom - padding * 0.9);
    }
  }
}

export class StudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private videoGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private voiceGain: GainNode | null = null;
  private sources: AudioBufferSourceNode[] = [];
  private frame = 0;
  private stopTimer = 0;

  music: AudioBuffer | null = null;
  voice: AudioBuffer | null = null;
  overlay: Overlay = { caption: "", productName: "", price: "", showProduct: true };
  volumes: Volumes = { original: 1, music: 0.6, voice: 1 };
  playing = false;

  constructor(
    private video: HTMLVideoElement,
    private canvas: HTMLCanvasElement,
    private font: string,
  ) {}

  get size() {
    const scale = Math.min(1, MAX_LONG_SIDE / Math.max(this.video.videoWidth || 720, this.video.videoHeight || 1280));
    return {
      width: Math.round(((this.video.videoWidth || 720) * scale) / 2) * 2,
      height: Math.round(((this.video.videoHeight || 1280) * scale) / 2) * 2,
    };
  }

  get duration() {
    return Number.isFinite(this.video.duration) ? this.video.duration : 0;
  }

  // Le contexte audio naît d'un geste de l'utilisateur, comme l'exigent les navigateurs mobiles.
  private audio() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.videoGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.voiceGain = this.ctx.createGain();
      this.ctx.createMediaElementSource(this.video).connect(this.videoGain).connect(this.master);
      this.musicGain.connect(this.master);
      this.voiceGain.connect(this.master);
      this.master.connect(this.ctx.destination);
    }
    this.applyVolumes();
    return this.ctx;
  }

  applyVolumes() {
    if (!this.videoGain || !this.musicGain || !this.voiceGain) return;
    this.videoGain.gain.value = this.volumes.original;
    this.musicGain.gain.value = this.volumes.music;
    this.voiceGain.gain.value = this.volumes.voice;
  }

  draw() {
    const { width, height } = this.size;
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    const context = this.canvas.getContext("2d");
    if (!context) return;
    context.drawImage(this.video, 0, 0, width, height);
    drawOverlay(context, width, height, this.overlay, this.font);
  }

  private startSources(ctx: AudioContext, { music = true, voice = true } = {}) {
    const at = ctx.currentTime + 0.05;
    for (const [buffer, gain, on] of [
      [this.music, this.musicGain, music],
      [this.voice, this.voiceGain, voice],
    ] as const) {
      if (!buffer || !gain || !on) continue;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(gain);
      source.start(at);
      this.sources.push(source);
    }
  }

  private loop = () => {
    this.draw();
    this.frame = requestAnimationFrame(this.loop);
  };

  // Lecture depuis le début. Renvoie une promesse tenue à la fin de la vidéo ou à l'arrêt.
  async play(options: { music?: boolean; voice?: boolean; original?: boolean } = {}) {
    const ctx = this.audio();
    await ctx.resume();
    this.stop();
    if (options.original === false && this.videoGain) this.videoGain.gain.value = 0;
    this.video.currentTime = 0;
    this.startSources(ctx, options);
    this.playing = true;
    await this.video.play();
    this.loop();
    return new Promise<void>((resolve) => {
      const done = () => {
        this.stop();
        resolve();
      };
      this.video.onended = done;
      // Filet de sécurité si l'événement de fin manque.
      this.stopTimer = window.setTimeout(done, (this.duration + 1.5) * 1000);
    });
  }

  stop() {
    cancelAnimationFrame(this.frame);
    window.clearTimeout(this.stopTimer);
    this.video.onended = null;
    this.video.pause();
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        // déjà arrêtée
      }
    }
    this.sources = [];
    this.playing = false;
    this.applyVolumes();
    this.draw();
  }

  // Voix off : la vidéo défile sans musique, le micro enregistre jusqu'à la fin.
  async recordVoice(stream: MediaStream) {
    const type = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((candidate) => MediaRecorder.isTypeSupported(candidate));
    const recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });

    recorder.start(250);
    await this.play({ music: false, voice: false, original: false });
    if (recorder.state !== "inactive") recorder.stop();
    await stopped;
    stream.getTracks().forEach((track) => track.stop());

    const blob = new Blob(chunks, { type: recorder.mimeType || type || "audio/webm" });
    this.voice = await this.audio().decodeAudioData(await blob.arrayBuffer());
    return this.voice.duration;
  }

  // Rendu final, en temps réel : l'image du canevas et le mélange audio, enregistrés ensemble.
  async render(onProgress: (ratio: number) => void) {
    const type = recorderType();
    if (!type) throw new Error("unsupported");

    const ctx = this.audio();
    await ctx.resume();
    const destination = ctx.createMediaStreamDestination();
    this.master!.disconnect();
    this.master!.connect(destination);

    const stream = this.canvas.captureStream(30);
    destination.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
    const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 2_500_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });

    const progress = window.setInterval(() => onProgress(Math.min(1, this.video.currentTime / (this.duration || 1))), 250);
    try {
      this.draw();
      recorder.start(1000);
      await this.play();
      recorder.stop();
      await stopped;
    } finally {
      window.clearInterval(progress);
      this.master!.disconnect();
      this.master!.connect(ctx.destination);
    }

    const baseType = type.split(";")[0];
    const blob = new Blob(chunks, { type: baseType });
    if (!blob.size) throw new Error("empty");
    onProgress(1);
    return new File([blob], baseType === "video/mp4" ? "video.mp4" : "video.webm", { type: baseType });
  }

  dispose() {
    this.stop();
    void this.ctx?.close();
  }
}
