import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isCourierAuthorized } from "@/lib/courier-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeTunisianPhone } from "@/lib/validations/common";

const NO_STORE = { "Cache-Control": "no-store" };

// Raccord de l'application des livreurs (voir docs/livraison-et-suivi.md). Sans jeton valable configuré,
// la route n'existe pas.
const codeSchema = z.string().trim().toUpperCase().regex(/^FRP-[A-Z0-9]{10}$/);

const updateSchema = z.object({
  trackingCode: codeSchema,
  status: z.enum(["in_transit", "out_for_delivery", "delivered", "failed", "returned"]).optional(),
  note: z.string().trim().max(300).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  eta: z.iso.datetime({ offset: true }).optional(),
  carrier: z.string().trim().max(60).optional(),
  courierName: z.string().trim().max(80).optional(),
  courierPhone: z.string().trim().optional(),
});

const KNOWN = new Set(["not_found", "invalid_transition", "invalid_position"]);

function denied() {
  return new NextResponse(null, { status: 404, headers: NO_STORE });
}

function failed(error: { message: string }) {
  if (KNOWN.has(error.message)) {
    return NextResponse.json({ error: error.message }, { status: error.message === "not_found" ? 404 : 409, headers: NO_STORE });
  }
  console.error("Livraison : erreur", { name: "rpc" });
  return NextResponse.json({ error: "unexpected" }, { status: 500, headers: NO_STORE });
}

// Le livreur consulte un colis : destinataire, adresse, somme à encaisser.
export async function GET(request: NextRequest) {
  if (!isCourierAuthorized(request.headers.get("authorization"))) return denied();

  const code = codeSchema.safeParse(request.nextUrl.searchParams.get("code"));
  if (!code.success) return NextResponse.json({ error: "invalid_code" }, { status: 400, headers: NO_STORE });

  const { data, error } = await createAdminClient().rpc("courier_shipment", { p_tracking_code: code.data });
  if (error) return failed(error);
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404, headers: NO_STORE });

  return NextResponse.json(data, { headers: NO_STORE });
}

// Le livreur signale une étape, sa position ou son arrivée prévue. Le client le voit en direct.
export async function POST(request: NextRequest) {
  if (!isCourierAuthorized(request.headers.get("authorization"))) return denied();

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400, headers: NO_STORE });

  const input = parsed.data;
  const phone = input.courierPhone ? normalizeTunisianPhone(input.courierPhone) : null;
  if (input.courierPhone && !phone) return NextResponse.json({ error: "invalid_phone" }, { status: 400, headers: NO_STORE });

  const { data, error } = await createAdminClient().rpc("courier_update", {
    p_tracking_code: input.trackingCode,
    p_status: input.status,
    p_note: input.note,
    p_latitude: input.latitude,
    p_longitude: input.longitude,
    p_eta: input.eta,
    p_carrier: input.carrier,
    p_courier_name: input.courierName,
    p_courier_phone: phone ?? undefined,
  });

  if (error) return failed(error);
  return NextResponse.json(data, { headers: NO_STORE });
}
