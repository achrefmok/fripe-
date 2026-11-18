"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewer } from "@/lib/permissions/viewer";
import { createClient } from "@/lib/supabase/server";
import { failure, rpcFailure, success, validationFailure, type ActionResult } from "@/lib/utils/action-result";
import { parsePriceToMillimes } from "@/lib/utils/price";
import {
  COLORS,
  findCheaperOutfit,
  GENDERS,
  getStylistEngine,
  isCoherentLook,
  OCCASIONS,
  SLOTS,
  STYLES,
  type RecommendedOutfit,
  type StyleItem,
} from "./engine";
import { getStyleCatalog } from "./queries";

const stylistSchema = z.object({
  size: z.string().trim().max(20),
  shoeSize: z.string().trim().max(20),
  budget: z.string().trim().min(1, "priceInvalid"),
  style: z.union([z.enum(STYLES), z.literal("")]),
  occasion: z.union([z.enum(OCCASIONS), z.literal("")]),
  colors: z.array(z.enum(COLORS)).max(6),
});

export async function recommendOutfits(input: unknown): Promise<ActionResult<RecommendedOutfit[]>> {
  const parsed = stylistSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const budgetMillimes = parsePriceToMillimes(parsed.data.budget);
  if (budgetMillimes === null) return failure("priceInvalid", { budget: "priceInvalid" });

  const catalog = await getStyleCatalog();
  const outfits = getStylistEngine().recommend({ ...parsed.data, budgetMillimes }, catalog);

  const viewer = await getViewer();

  if (viewer) {
    const supabase = await createClient();
    const { error } = await supabase.from("style_preferences").upsert({
      user_id: viewer.id,
      size: parsed.data.size || null,
      shoe_size: parsed.data.shoeSize || null,
      style: parsed.data.style || null,
      occasion: parsed.data.occasion || null,
      colors: parsed.data.colors,
      budget_millimes: budgetMillimes,
    });

    // Les tenues restent utiles même si la mémorisation des préférences échoue.
    if (error) console.error("Préférences de style", { code: error.code });
  }

  return success(outfits);
}

export async function searchSlotItems(slot: string, search: string, gender: string | null = null): Promise<ActionResult<StyleItem[]>> {
  const parsedSlot = z.enum(SLOTS).safeParse(slot);
  const parsedGender = z.enum(GENDERS).nullable().safeParse(gender);
  if (!parsedSlot.success || !parsedGender.success) return failure("invalidInput");

  const items = await getStyleCatalog({ slot: parsedSlot.data, search: search.trim().slice(0, 60), gender: parsedGender.data });
  return success(items.slice(0, 30));
}

export async function suggestCheaperOutfit(
  productIds: string[],
): Promise<ActionResult<{ items: StyleItem[]; savingMillimes: number } | null>> {
  const ids = z.array(z.uuid()).min(1).max(SLOTS.length).safeParse(productIds);
  if (!ids.success) return failure("invalidInput");

  const catalog = await getStyleCatalog();
  const current = await getStyleCatalog({ ids: ids.data });

  return success(findCheaperOutfit(current, catalog));
}

const outfitSchema = z.object({
  outfitId: z.uuid().nullable(),
  name: z.string().trim().min(2, "nameTooShort").max(60, "nameTooLong"),
  budget: z.string().trim(),
  isPublic: z.boolean(),
  items: z
    .array(z.object({ slot: z.enum(SLOTS), productId: z.uuid() }))
    .min(1, "outfitEmpty")
    .max(SLOTS.length)
    // Une robe ne se porte ni avec un haut ni avec un bas.
    .refine((items) => isCoherentLook(items.map((item) => item.slot)), "outfitIncoherent"),
});

export async function saveOutfit(input: unknown): Promise<ActionResult<{ outfitId: string }>> {
  const parsed = outfitSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error);

  const budget = parsed.data.budget ? parsePriceToMillimes(parsed.data.budget) : null;
  if (parsed.data.budget && budget === null) return failure("priceInvalid", { budget: "priceInvalid" });

  if (!(await getViewer())) return failure("sessionExpired");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_outfit", {
    p_outfit_id: parsed.data.outfitId as string,
    p_name: parsed.data.name,
    p_budget_millimes: budget as number,
    p_is_public: parsed.data.isPublic,
    p_items: parsed.data.items.map((item) => ({ slot: item.slot, product_id: item.productId })),
  });

  if (error) return rpcFailure(error);

  revalidatePath("/[locale]/tenues", "page");
  return success({ outfitId: data });
}

export async function deleteOutfit(outfitId: string): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return failure("sessionExpired");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("outfits")
    .delete()
    .eq("id", outfitId)
    .eq("user_id", viewer.id)
    .select("id");

  if (error) return rpcFailure(error);
  if (!data.length) return failure("forbidden");

  revalidatePath("/[locale]/tenues", "page");
  return success();
}

export async function addItemsToCart(productIds: string[]): Promise<ActionResult> {
  const ids = z.array(z.uuid()).min(1).max(SLOTS.length).safeParse(productIds);
  if (!ids.success) return failure("invalidInput");

  const viewer = await getViewer();
  if (!viewer) return failure("sessionExpired");

  // Vérification serveur : seules les pièces encore disponibles entrent au panier.
  const available = await getStyleCatalog({ ids: ids.data });
  if (!available.length) return failure("product_unavailable");

  const supabase = await createClient();
  const { error } = await supabase
    .from("cart_items")
    .upsert(available.map((item) => ({ user_id: viewer.id, product_id: item.id })), {
      ignoreDuplicates: true,
    });

  if (error) return rpcFailure(error);

  revalidatePath("/[locale]/panier", "page");
  return success();
}
