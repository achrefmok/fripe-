import { NextResponse, type NextRequest } from "next/server";
import { isMaintenanceAuthorized } from "@/lib/maintenance-auth";
import { runMaintenance } from "@/lib/maintenance";

const NO_STORE = { "Cache-Control": "no-store" };

export const maxDuration = 120;

// Appelée par un planificateur externe, voir docs/maintenance.md. Sans jeton valable configuré,
// la route n'existe pas : un jeton court ne doit jamais ouvrir l'accès à la clé secrète.
export async function POST(request: NextRequest) {
  if (!isMaintenanceAuthorized(request.headers.get("authorization"))) {
    return new NextResponse(null, { status: 404, headers: NO_STORE });
  }

  try {
    const result = await runMaintenance();

    return NextResponse.json(result, {
      status: result.status === "skipped" ? 409 : result.status === "partial" ? 207 : 200,
      headers: NO_STORE,
    });
  } catch (error) {
    console.error("Maintenance en échec", { name: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json({ status: "failed" }, { status: 500, headers: NO_STORE });
  }
}
