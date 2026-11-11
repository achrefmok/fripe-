"use server";

import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/permissions/viewer";

// Les favoris du visiteur, chargés après coup : les pages du Vide-Dressing restent les mêmes pour
// tout le monde et peuvent être servies depuis le cache.
export async function getMyListingFavoriteIds(): Promise<{ signedIn: boolean; ids: string[] }> {
  const viewer = await getViewer();
  if (!viewer) return { signedIn: false, ids: [] };

  const supabase = await createClient();
  const { data } = await supabase.from("listing_favorites").select("listing_id").eq("user_id", viewer.id).limit(500);

  return { signedIn: true, ids: (data ?? []).map((row) => row.listing_id) };
}
