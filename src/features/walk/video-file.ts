// Traitement local dans le navigateur : aucun serveur d'encodage n'est disponible.
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 60;

const MAX_LONG_SIDE = 1280;
const COMPRESS_ABOVE_BYTES = 15 * 1024 * 1024;

export type VideoInfo = { duration: number; width: number; height: number };

function loadVideo(file: Blob) {
  return new Promise<{ video: HTMLVideoElement; url: string }>((resolve, reject) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);

    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.onloadedmetadata = () => resolve({ video, url });
    video.onerror = () => reject(new Error("video_unreadable"));
    video.src = url;
  });
}

// Les vidéos enregistrées par MediaRecorder annoncent parfois une durée infinie.
async function resolveDuration(video: HTMLVideoElement) {
  if (Number.isFinite(video.duration)) return video.duration;

  await new Promise<void>((resolve) => {
    video.ondurationchange = () => {
      if (Number.isFinite(video.duration)) resolve();
    };
    video.currentTime = 1e7;
  });

  video.ondurationchange = null;
  video.currentTime = 0;
  return video.duration;
}

export async function inspectVideo(file: Blob): Promise<VideoInfo> {
  const { video, url } = await loadVideo(file);

  try {
    return {
      duration: await resolveDuration(video),
      width: video.videoWidth,
      height: video.videoHeight,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function captureThumbnail(file: Blob, info: VideoInfo) {
  const { video, url } = await loadVideo(file);

  try {
    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error("video_unreadable"));
      video.currentTime = Math.min(0.5, info.duration / 2);
    });

    const scale = Math.min(1, 720 / Math.max(info.width, info.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(info.width * scale);
    canvas.height = Math.round(info.height * scale);
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
    if (!blob) throw new Error("video_unreadable");

    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function exceedsResolution(info: VideoInfo) {
  return Math.max(info.width, info.height) > MAX_LONG_SIDE;
}

export function needsCompression(file: Blob, info: VideoInfo) {
  return file.size > COMPRESS_ABOVE_BYTES || exceedsResolution(info);
}

function recorderType() {
  const types = ["video/mp4;codecs=avc1", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  return typeof MediaRecorder === "undefined"
    ? null
    : (types.find((type) => MediaRecorder.isTypeSupported(type)) ?? null);
}

// Réencode en temps réel à 720p. Renvoie null si le navigateur ne sait pas le faire :
// le fichier d'origine est alors envoyé s'il respecte la limite de taille.
export async function compressVideo(
  file: Blob,
  info: VideoInfo,
  onProgress: (ratio: number) => void,
): Promise<File | null> {
  const type = recorderType();
  const canvas = document.createElement("canvas");

  if (!type || !("captureStream" in canvas)) return null;

  const { video, url } = await loadVideo(file);

  try {
    const scale = Math.min(1, MAX_LONG_SIDE / Math.max(info.width, info.height));
    canvas.width = Math.round((info.width * scale) / 2) * 2;
    canvas.height = Math.round((info.height * scale) / 2) * 2;

    const context = canvas.getContext("2d");
    const stream = canvas.captureStream(30);

    const source = video as HTMLVideoElement & { captureStream?: () => MediaStream };
    source.captureStream?.().getAudioTracks().forEach((track) => stream.addTrack(track));

    const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 2_000_000 });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };

    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });

    let frame = 0;
    const draw = () => {
      context?.drawImage(video, 0, 0, canvas.width, canvas.height);
      onProgress(Math.min(video.currentTime / info.duration, 1));
      frame = requestAnimationFrame(draw);
    };

    recorder.start(1000);
    await video.play();
    draw();

    await new Promise<void>((resolve, reject) => {
      video.onended = () => resolve();
      video.onerror = () => reject(new Error("video_unreadable"));
    });

    cancelAnimationFrame(frame);
    recorder.stop();
    await stopped;

    const baseType = type.split(";")[0];
    const blob = new Blob(chunks, { type: baseType });

    if (!blob.size) return null;

    return new File([blob], baseType === "video/mp4" ? "video.mp4" : "video.webm", { type: baseType });
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
