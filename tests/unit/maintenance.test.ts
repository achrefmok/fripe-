import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const rpc = vi.fn();
const remove = vi.fn();
const update = vi.fn(() => ({ eq: vi.fn(async () => ({})), in: vi.fn(async () => ({})) }));
const deleteUser = vi.fn();
let pendingAccounts: { user_id: string; attempts: number }[] = [];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc,
    storage: { from: () => ({ remove }) },
    auth: { admin: { deleteUser } },
    from: () => ({
      update,
      select: () => ({
        is: () => ({ lt: () => ({ order: () => ({ limit: async () => ({ data: pendingAccounts, error: null }) }) }) }),
      }),
    }),
  }),
}));

const { runMaintenance } = await import("@/lib/maintenance");
const { POST } = await import("@/app/api/internal/maintenance/route");

const TOKEN = "t".repeat(40);

function call(headers: Record<string, string> = {}) {
  return POST(new NextRequest("http://localhost/api/internal/maintenance", { method: "POST", headers }));
}

function database(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    begin_maintenance_run: { data: "run-1", error: null },
    next_storage_purge: { data: [], error: null },
    finish_maintenance_run: { data: null, error: null },
    ...overrides,
  };

  rpc.mockImplementation(async (name: string) => values[name]);
}

beforeEach(() => {
  vi.clearAllMocks();
  pendingAccounts = [];
  vi.stubEnv("MAINTENANCE_TOKEN", TOKEN);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
  database();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("accès à la maintenance", () => {
  it.each([
    ["sans en-tête", {}],
    ["jeton faux", { authorization: `Bearer ${"x".repeat(40)}` }],
    ["jeton tronqué", { authorization: `Bearer ${TOKEN.slice(0, 20)}` }],
    ["jeton sans préfixe", { authorization: TOKEN }],
  ])("répond 404 %s et ne touche à rien", async (_label, headers) => {
    const response = await call(headers);

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("répond 404 si aucun jeton n'est configuré", async () => {
    vi.stubEnv("MAINTENANCE_TOKEN", "");
    expect((await call({ authorization: "Bearer " })).status).toBe(404);
  });

  it("refuse un jeton configuré trop court, même exact", async () => {
    vi.stubEnv("MAINTENANCE_TOKEN", "court");
    expect((await call({ authorization: "Bearer court" })).status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("n'envoie jamais de cache", async () => {
    const response = await call({ authorization: `Bearer ${TOKEN}` });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});

describe("résultats de la maintenance", () => {
  const authorized = { authorization: `Bearer ${TOKEN}` };

  it("signale un passage réussi et le consigne", async () => {
    const response = await call(authorized);

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("finish_maintenance_run", expect.objectContaining({ p_status: "succeeded" }));
  });

  it("répond 409 sans rien faire si un passage tourne déjà", async () => {
    database({ begin_maintenance_run: { data: null, error: null } });

    const response = await call(authorized);

    expect(response.status).toBe(409);
    expect(rpc).not.toHaveBeenCalledWith("next_storage_purge", expect.anything());
    expect(remove).not.toHaveBeenCalled();
  });

  it("répond 207 et laisse en file ce qui a échoué", async () => {
    database({
      next_storage_purge: { data: [{ id: 1, bucket: "shop-videos", path: "a", attempts: 2 }], error: null },
    });
    remove.mockResolvedValue({ error: { name: "StorageError" } });

    const response = await call(authorized);

    expect(response.status).toBe(207);
    expect(await response.json()).toMatchObject({ status: "partial", storage: { removed: 0, failed: 1 } });
    expect(update).toHaveBeenCalledWith({ attempts: 3 });
    expect(rpc).toHaveBeenCalledWith("finish_maintenance_run", expect.objectContaining({ p_status: "partial" }));
  });

  it("compte une fiche déjà absente comme traitée", async () => {
    pendingAccounts = [{ user_id: "u", attempts: 0 }];
    deleteUser.mockResolvedValue({ error: { status: 404, code: "user_not_found" } });

    const result = await runMaintenance();

    expect(result).toMatchObject({ status: "succeeded", accounts: { completed: 1, failed: 0 } });
  });

  it("répond 500, consigne l'échec et libère le verrou", async () => {
    database({ next_storage_purge: { data: null, error: new TypeError("panne") } });

    const response = await call(authorized);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ status: "failed" });
    expect(rpc).toHaveBeenCalledWith("finish_maintenance_run", expect.objectContaining({ p_status: "failed", p_error: "TypeError" }));
  });
});
