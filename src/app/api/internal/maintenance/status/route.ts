import { NextResponse, type NextRequest } from "next/server";
import { isMaintenanceAuthorized } from "@/lib/maintenance-auth";
import { getMaintenanceHealth } from "@/lib/maintenance";

const NO_STORE = { "Cache-Control": "no-store" };

// Pour une sonde externe : 503 si aucun passage réussi récent, ce qui déclenche son alerte.
export async function POST(request: NextRequest) {
  if (!isMaintenanceAuthorized(request.headers.get("authorization"))) {
    return new NextResponse(null, { status: 404, headers: NO_STORE });
  }

  const health = await getMaintenanceHealth();

  return NextResponse.json(health, { status: health.stale ? 503 : 200, headers: NO_STORE });
}
