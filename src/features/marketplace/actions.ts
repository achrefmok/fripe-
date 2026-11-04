"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MAX_IMAGE_BYTES } from "@/features/catalog/constants";
import { processStoragePurge } from "@/lib/maintenance";
import { getViewer } from "@/lib/permissions/viewer";
import { createClient } from "@/lib/supabase/server";
import { failure, rpcFailure, success, validationFailure, type ActionResult } from "@/lib/utils/action-result";
import { detectImageKind } from "@/lib/utils/image-file";
import { listingSchema, messageSchema } from "./schemas";

const idSchema = z.uuid();

async function activeViewer() {
  const viewer = await getViewer();
  if (!viewer) return failure("sessionExpired");
  if (viewer.status !== "active") return failure("forbidden");
  return viewer;
}

function revalidateListing(listingId?: string) {
  revalidatePath("/[locale]/marketplace", "page");
  revalidatePath("/[locale]/vide-dressing", "page");
  revalidatePath("/[locale]/compte/annonces", "page");
  if (listingId) revalidatePath(`/[locale]/annonce/${listingId}`, "page");
}

function toRow(data: z.output<typeof listingSchema>) {
  return {
    category_id: data.categoryId,
    title: data.title,
    description: data.description,
    brand: data.brand,
    size: data.section === "vide_dressing" ? data.size : null,
    condition: data.condition,
    price_millimes: data.price,
    governorate_id: data.governorateId,
    city_id: data.cityId,
    attributes: data.section === "marketplace" ? data.attributes : {},
  };
}

export async function createListing(input: unknown): Promise<ActionResult<{ listingId: string }>> {
  const parsed = listingSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const viewer = await activeViewer();
  if ("ok" in viewer) return viewer;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .insert({ ...toRow(parsed.data), section: parsed.data.section, publication_status: "published" })
    .select("id")
    .single();

  if (error) return rpcFailure(error);

  revalidateListing();
  return success({ listingId: data.id });
}

export async function updateListing(listingId: string, input: unknown): Promise<ActionResult> {
  if (!idSchema.safeParse(listingId).success) return failure("not_found");

  const parsed = listingSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const viewer = await activeViewer();
  if ("ok" in viewer) return viewer;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .update(toRow(parsed.data))
    .eq("id", listingId)
    .eq("seller_id", viewer.id)
    .select("id");

  if (error) return rpcFailure(error);
  if (!data.length) return failure("forbidden");

  revalidateListing(listingId);
  return success();
}

const stateSchema = z.enum(["available", "reserved", "sold", "hidden", "published"]);

// Disponible, réservée, vendue : la vente se conclut entre les personnes, le vendeur l'indique ici.
export async function setListingState(listingId: string, state: string): Promise<ActionResult> {
  const parsed = stateSchema.safeParse(state);
  if (!idSchema.safeParse(listingId).success || !parsed.success) return failure("not_found");

  const viewer = await activeViewer();
  if ("ok" in viewer) return viewer;

  const patch =
    parsed.data === "hidden"
      ? { publication_status: "archived" as const }
      : parsed.data === "published"
        ? { publication_status: "published" as const }
        : { status: parsed.data };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .update(patch)
    .eq("id", listingId)
    .eq("seller_id", viewer.id)
    .select("id");

  if (error) return rpcFailure(error);
  if (!data.length) return failure("forbidden");

  revalidateListing(listingId);
  return success();
}

export async function deleteListing(listingId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(listingId).success) return failure("not_found");

  const viewer = await getViewer();
  if (!viewer) return failure("sessionExpired");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .delete()
    .eq("id", listingId)
    .eq("seller_id", viewer.id)
    .select("id");

  if (error) return rpcFailure(error);
  if (!data.length) return failure("forbidden");

  // Les photos sont déjà dans la file de purge : on la traite tout de suite.
  await processStoragePurge();
  revalidateListing(listingId);
  return success();
}

export async function uploadListingImage(listingId: string, formData: FormData): Promise<ActionResult> {
  if (!idSchema.safeParse(listingId).success) return failure("not_found");

  const viewer = await activeViewer();
  if ("ok" in viewer) return viewer;

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return failure("invalidImage");
  if (file.size > MAX_IMAGE_BYTES) return failure("imageTooLarge");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = detectImageKind(bytes);
  if (!kind) return failure("invalidImage");

  const supabase = await createClient();
  const { data: listing } = await supabase
    .from("listings")
    .select("id, listing_images (id)")
    .eq("id", listingId)
    .eq("seller_id", viewer.id)
    .maybeSingle();

  if (!listing) return failure("forbidden");

  const path = `${viewer.id}/${listingId}/${crypto.randomUUID()}.${kind.extension}`;
  const bucket = supabase.storage.from("listing-images");

  const { error: uploadError } = await bucket.upload(path, bytes, { contentType: kind.mime });
  if (uploadError) {
    console.error("Envoi de photo d'annonce", { name: uploadError.name });
    return failure("too_many_images");
  }

  const { error } = await supabase
    .from("listing_images")
    .insert({ listing_id: listingId, path, position: listing.listing_images.length });

  // Le fichier sans ligne sera retiré par le balayage des fichiers orphelins.
  if (error) return rpcFailure(error);

  revalidateListing(listingId);
  return success();
}

export async function deleteListingImage(imageId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(imageId).success) return failure("not_found");

  const viewer = await getViewer();
  if (!viewer) return failure("sessionExpired");

  const supabase = await createClient();
  const { data, error } = await supabase.from("listing_images").delete().eq("id", imageId).select("listing_id");

  if (error) return rpcFailure(error);
  if (!data.length) return failure("forbidden");

  await processStoragePurge();
  revalidateListing(data[0].listing_id);
  return success();
}

export async function toggleListingFavorite(listingId: string, favorite: boolean): Promise<ActionResult> {
  if (!idSchema.safeParse(listingId).success) return failure("not_found");

  const viewer = await activeViewer();
  if ("ok" in viewer) return viewer;

  const supabase = await createClient();
  const { error } = favorite
    ? await supabase.from("listing_favorites").upsert({ user_id: viewer.id, listing_id: listingId }, { ignoreDuplicates: true })
    : await supabase.from("listing_favorites").delete().eq("user_id", viewer.id).eq("listing_id", listingId);

  if (error) return rpcFailure(error);

  revalidatePath("/[locale]/compte/favoris", "page");
  return success();
}

export async function contactSeller(listingId: string, body: string): Promise<ActionResult<{ threadId: string }>> {
  const parsedBody = messageSchema.safeParse(body);
  if (!idSchema.safeParse(listingId).success) return failure("not_found");
  if (!parsedBody.success) return validationFailure(parsedBody.error);

  if (!(await getViewer())) return failure("sessionExpired");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("contact_listing", { p_listing_id: listingId, p_body: parsedBody.data });

  if (error) return rpcFailure(error);

  revalidatePath("/[locale]/compte/echanges", "page");
  return success({ threadId: data });
}

export async function sendListingMessage(threadId: string, body: string): Promise<ActionResult> {
  const parsedBody = messageSchema.safeParse(body);
  if (!idSchema.safeParse(threadId).success) return failure("not_found");
  if (!parsedBody.success) return validationFailure(parsedBody.error);

  if (!(await getViewer())) return failure("sessionExpired");

  const supabase = await createClient();
  const { error } = await supabase.rpc("send_listing_message", { p_thread_id: threadId, p_body: parsedBody.data });

  if (error) return rpcFailure(error);
  return success();
}

export async function fetchListingMessagesSince(threadId: string, since: string | null) {
  if (!idSchema.safeParse(threadId).success) return [];

  const viewer = await getViewer();
  if (!viewer) return [];

  const supabase = await createClient();
  let query = supabase
    .from("listing_messages")
    .select("id, sender_id, body, created_at")
    .eq("thread_id", threadId)
    .order("created_at")
    .limit(100);

  if (since) query = query.gt("created_at", since);

  const { data } = await query;
  return (data ?? []).map((message) => ({ ...message, mine: message.sender_id === viewer.id }));
}

export async function markListingThreadRead(threadId: string): Promise<void> {
  if (!idSchema.safeParse(threadId).success) return;

  const supabase = await createClient();
  await supabase.rpc("mark_listing_thread_read", { p_thread_id: threadId });
}

export async function blockPerson(userId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(userId).success) return failure("not_found");
  if (!(await getViewer())) return failure("sessionExpired");

  const supabase = await createClient();
  const { error } = await supabase.rpc("block_person", { p_user_id: userId });

  if (error) return rpcFailure(error);

  revalidatePath("/[locale]/compte/echanges", "layout");
  return success();
}

export async function unblockPerson(userId: string): Promise<ActionResult> {
  if (!idSchema.safeParse(userId).success) return failure("not_found");

  const supabase = await createClient();
  const { error } = await supabase.rpc("unblock_person", { p_user_id: userId });

  if (error) return rpcFailure(error);

  revalidatePath("/[locale]/compte/blocages", "page");
  return success();
}

export async function moderateListing(listingId: string, note: string): Promise<ActionResult> {
  if (!idSchema.safeParse(listingId).success) return failure("not_found");

  const supabase = await createClient();
  const { error } = await supabase.rpc("moderate_listing", { p_listing_id: listingId, p_note: note });

  if (error) return rpcFailure(error);

  await processStoragePurge();
  revalidateListing(listingId);
  revalidatePath("/[locale]/admin/annonces", "page");
  return success();
}
