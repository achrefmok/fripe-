"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getPublicEnv } from "@/lib/env";
import { getViewer } from "@/lib/permissions/viewer";
import { createClient } from "@/lib/supabase/server";
import { failure, rpcFailure, success, type ActionResult } from "@/lib/utils/action-result";
import { detectVideoKind } from "@/lib/utils/image-file";
import { moderateMedia } from "@/features/media-moderation/moderate";
import { getWalkPage, type WalkItem } from "./queries";

const idSchema = z.uuid();

const finalizeSchema = z.object({
  videoId: z.uuid(),
  videoPath: z.string().max(200),
  thumbnailPath: z.string().max(200),
  durationSeconds: z.number().int().min(1).max(60),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

function revalidateVideos(shopId: string) {
  revalidatePath(`/[locale]/vendeur/boutique/${shopId}`, "layout");
  revalidatePath("/[locale]/walk", "page");
}

export async function loadWalkPage(
  cursor: string,
): Promise<ActionResult<{ items: WalkItem[]; nextCursor: string | null }>> {
  if (Number.isNaN(Date.parse(cursor))) return failure("invalidInput");
  return success(await getWalkPage(cursor));
}

export async function createVideoDraft(
  shopId: string,
  description: string,
): Promise<ActionResult<{ videoId: string }>> {
  if (!idSchema.safeParse(shopId).success) return failure("not_found");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_video_draft", {
    p_shop_id: shopId,
    p_description: description.slice(0, 300),
  });

  if (error) return rpcFailure(error);

  return success({ videoId: data });
}

// Les fichiers déposés par le navigateur sont relus en entier pour l'analyse (60 s, 50 Mo au plus).
async function moderateUploadedVideo(userId: string, videoPath: string, thumbnailPath: string, mime: string) {
  const base = `${getPublicEnv().url}/storage/v1/object/public/shop-videos/`;
  const [video, thumbnail] = await Promise.all(
    [videoPath, thumbnailPath].map((path) => fetch(base + path, { cache: "no-store" }).then((response) => (response.ok ? response.arrayBuffer() : null))),
  );
  if (!video || !thumbnail) return { ok: false as const, error: "video_missing" };

  return moderateMedia({
    userId,
    context: "shop_video",
    mediaKind: "video",
    parts: [
      { bytes: new Uint8Array(video), mime, kind: "video" },
      { bytes: new Uint8Array(thumbnail), mime: "image/jpeg", kind: "image" },
    ],
  });
}

// Le navigateur a déposé les fichiers : on relit l'en-tête réel avant de publier.
export async function finalizeVideo(shopId: string, input: unknown): Promise<ActionResult> {
  const parsed = finalizeSchema.safeParse(input);
  if (!parsed.success) return failure("invalidInput");

  const { videoId, videoPath, thumbnailPath, durationSeconds, width, height } = parsed.data;

  // Ces chemins servent à une lecture et à un nettoyage : rien hors du dossier de ce brouillon.
  const folder = `${shopId}/${videoId}/`;
  const isOwnFile = (path: string) => path.startsWith(folder) && /^[\w-]+\.[a-z0-9]+$/.test(path.slice(folder.length));
  if (!isOwnFile(videoPath) || !isOwnFile(thumbnailPath)) return failure("forbidden");

  const supabase = await createClient();
  const bucket = supabase.storage.from("shop-videos");

  const header = await fetch(
    `${getPublicEnv().url}/storage/v1/object/public/shop-videos/${videoPath}`,
    { headers: { Range: "bytes=0-31" }, cache: "no-store" },
  );

  const kind = header.ok ? detectVideoKind(new Uint8Array(await header.arrayBuffer())) : null;
  if (!kind) {
    await bucket.remove([videoPath, thumbnailPath]);
    await supabase.from("videos").delete().eq("id", videoId);
    return failure("invalidVideo");
  }

  // La vidéo et sa miniature sont analysées avant la publication ; bloquées, elles sont effacées.
  const viewer = await getViewer();
  if (!viewer) return failure("sessionExpired");
  const moderation = await moderateUploadedVideo(viewer.id, videoPath, thumbnailPath, kind.mime);
  if (!moderation.ok) {
    await bucket.remove([videoPath, thumbnailPath]);
    await supabase.from("videos").delete().eq("id", videoId);
    return failure(moderation.error);
  }

  const { error } = await supabase.rpc("finalize_video", {
    p_video_id: videoId,
    p_video_path: videoPath,
    p_thumbnail_path: thumbnailPath,
    p_duration_seconds: durationSeconds,
    p_width: width,
    p_height: height,
  });

  if (error) {
    await bucket.remove([videoPath, thumbnailPath]);
    await supabase.from("videos").delete().eq("id", videoId);
    return rpcFailure(error);
  }

  revalidateVideos(shopId);
  return success();
}

export async function setVideoStatus(
  shopId: string,
  videoId: string,
  status: "published" | "archived",
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_video_status", { p_video_id: videoId, p_status: status });

  if (error) return rpcFailure(error);

  revalidateVideos(shopId);
  return success();
}

export async function setVideoProducts(
  shopId: string,
  videoId: string,
  productIds: string[],
): Promise<ActionResult> {
  const ids = z.array(z.uuid()).max(8).safeParse(productIds);
  if (!ids.success) return failure("too_many_items");

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_video_products", {
    p_video_id: videoId,
    p_product_ids: ids.data,
  });

  if (error) return rpcFailure(error);

  revalidateVideos(shopId);
  return success();
}

export async function deleteVideo(shopId: string, videoId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("videos")
    .delete()
    .eq("id", videoId)
    .eq("shop_id", shopId)
    .select("video_path, thumbnail_path");

  if (error) return rpcFailure(error);
  if (!data.length) return failure("forbidden");

  const paths = [data[0].video_path, data[0].thumbnail_path].filter((path) => path !== null);
  if (paths.length) await supabase.storage.from("shop-videos").remove(paths);

  revalidateVideos(shopId);
  return success();
}

export async function toggleVideoFavorite(videoId: string): Promise<ActionResult<{ favorite: boolean }>> {
  if (!idSchema.safeParse(videoId).success) return failure("not_found");

  const viewer = await getViewer();
  if (!viewer) return failure("sessionExpired");

  const supabase = await createClient();
  const { data: removed, error } = await supabase
    .from("video_favorites")
    .delete()
    .eq("user_id", viewer.id)
    .eq("video_id", videoId)
    .select("video_id");

  if (error) return rpcFailure(error);
  if (removed.length) return success({ favorite: false });

  const { error: insertError } = await supabase
    .from("video_favorites")
    .insert({ user_id: viewer.id, video_id: videoId });

  if (insertError) return rpcFailure(insertError);

  return success({ favorite: true });
}
