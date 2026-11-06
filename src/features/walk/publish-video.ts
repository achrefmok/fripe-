"use client";

import { createVideoDraft, finalizeVideo, setVideoProducts } from "@/features/walk/actions";
import { createClient } from "@/lib/supabase/client";
import {
  captureThumbnail,
  compressVideo,
  exceedsResolution,
  inspectVideo,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_SECONDS,
  needsCompression,
} from "./video-file";

export const VIDEO_EXTENSIONS: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export type PublishStep = { key: "checking" | "thumbnail" | "uploading" } | { key: "compressing"; percent: number };

// Le circuit unique de publication : vérification, compression locale si besoin, miniature, envoi
// direct au stockage, relecture de l'en-tête par le serveur, puis pièces associées.
// Utilisé par l'import d'un fichier comme par le studio. Renvoie un code d'erreur, ou null.
export async function publishVideoFile(
  shopId: string,
  picked: File,
  options: { description: string; productIds?: string[]; onStep: (step: PublishStep) => void },
): Promise<{ error: string } | { videoId: string }> {
  const type = picked.type.split(";")[0];
  if (!VIDEO_EXTENSIONS[type]) return { error: "invalidVideo" };

  options.onStep({ key: "checking" });
  const info = await inspectVideo(picked);
  if (info.duration > MAX_VIDEO_SECONDS + 0.5) return { error: "video_too_long" };

  let file: File = type === picked.type ? picked : new File([picked], picked.name, { type });

  if (needsCompression(file, info)) {
    options.onStep({ key: "compressing", percent: 0 });
    const compressed = await compressVideo(file, info, (ratio) =>
      options.onStep({ key: "compressing", percent: Math.round(ratio * 100) }),
    );

    // Une définition trop haute est réduite même si le fichier reste de taille comparable.
    if (compressed && (compressed.size < file.size || exceedsResolution(info))) file = compressed;
  }

  if (file.size > MAX_VIDEO_BYTES) return { error: "video_too_large" };

  const finalInfo = file === picked ? info : await inspectVideo(file);

  options.onStep({ key: "thumbnail" });
  const thumbnail = await captureThumbnail(file, finalInfo);

  options.onStep({ key: "uploading" });
  const draft = await createVideoDraft(shopId, options.description);
  if (!draft.ok) return { error: draft.error };

  const { videoId } = draft.data;
  const folder = `${shopId}/${videoId}`;
  const videoPath = `${folder}/video.${VIDEO_EXTENSIONS[file.type.split(";")[0]]}`;
  const thumbnailPath = `${folder}/thumbnail.jpg`;
  const bucket = createClient().storage.from("shop-videos");

  const [uploadedVideo, uploadedThumbnail] = await Promise.all([
    bucket.upload(videoPath, file, { contentType: file.type.split(";")[0], cacheControl: "31536000" }),
    bucket.upload(thumbnailPath, thumbnail, { contentType: "image/jpeg", cacheControl: "31536000" }),
  ]);

  if (uploadedVideo.error || uploadedThumbnail.error) return { error: "unexpected" };

  const result = await finalizeVideo(shopId, {
    videoId,
    videoPath,
    thumbnailPath,
    durationSeconds: Math.min(MAX_VIDEO_SECONDS, Math.max(1, Math.round(finalInfo.duration))),
    width: finalInfo.width,
    height: finalInfo.height,
  });
  if (!result.ok) return { error: result.error };

  if (options.productIds?.length) {
    const linked = await setVideoProducts(shopId, videoId, options.productIds);
    if (!linked.ok) return { error: linked.error };
  }

  return { videoId };
}
