import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export const ORDER_PAGE_SIZE = 20;

type OrderStatus = Database["public"]["Enums"]["order_status"];

export async function getCart(viewerId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cart_items")
    .select(
      "product_id, products (id, title, price_millimes, size, status, publication_status, shop_id, shops (id, name), product_images (path, position))",
    )
    .eq("user_id", viewerId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const { data: reservations } = await supabase
    .from("reservations")
    .select("product_id")
    .eq("client_id", viewerId)
    .eq("status", "active");

  const mine = new Set(reservations?.map((reservation) => reservation.product_id));

  return data.flatMap(({ products: product }) => {
    if (!product?.shops) return [];

    const purchasable =
      product.publication_status === "published" &&
      (product.status === "available" || (product.status === "reserved" && mine.has(product.id)));

    return [
      {
        id: product.id,
        title: product.title ?? "",
        size: product.size,
        priceMillimes: product.price_millimes ?? 0,
        status: product.status,
        purchasable,
        shopId: product.shops.id,
        shopName: product.shops.name,
        imagePath:
          [...product.product_images].sort((a, b) => a.position - b.position)[0]?.path ?? null,
      },
    ];
  });
}

export async function listMyReservations(viewerId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reservations")
    .select(
      "id, status, expires_at, created_at, product_id, products (title, price_millimes, status, product_images (path, position))",
    )
    .eq("client_id", viewerId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;

  return data;
}

export async function listMyOrders(viewerId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, status, fulfillment, total_millimes, created_at, shops (name), order_groups (reference), order_items (id)",
    )
    .eq("client_id", viewerId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;

  return data;
}

const ORDER_DETAIL =
  "*, shops (name, slug, phone), order_groups (reference, recipient_name, phone, address_line, payment_method, governorates (name_fr, name_ar), cities (name_fr, name_ar)), order_items (id, product_id, title, brand, size, price_millimes, image_path)";

export async function getOrder(orderId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_DETAIL)
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function getOrderGroup(groupId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("order_groups")
    .select("id, reference, orders (id, status, fulfillment, total_millimes, delivery_fee_millimes, shops (name))")
    .eq("id", groupId)
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function listShopOrders(shopId: string, status: OrderStatus | null, page: number) {
  const supabase = await createClient();
  const from = (page - 1) * ORDER_PAGE_SIZE;

  let query = supabase
    .from("orders")
    .select(
      "id, status, fulfillment, total_millimes, created_at, order_groups (reference, recipient_name), order_items (id)",
      { count: "exact" },
    )
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false })
    .range(from, from + ORDER_PAGE_SIZE - 1);

  if (status) query = query.eq("status", status);

  const { data, count, error } = await query;
  if (error) throw error;

  return { orders: data, total: count ?? 0 };
}

export async function listShopReservations(shopId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reservations")
    .select("id, expires_at, products (title)")
    .eq("shop_id", shopId)
    .eq("status", "active")
    .order("expires_at");

  if (error) throw error;

  return data;
}

export async function listAllOrders(status: OrderStatus | null, page: number, reference = "") {
  const supabase = await createClient();
  const from = (page - 1) * ORDER_PAGE_SIZE;

  let query = supabase
    .from("orders")
    .select(
      "id, status, fulfillment, total_millimes, created_at, shops (name), order_groups!inner (reference)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, from + ORDER_PAGE_SIZE - 1);

  if (status) query = query.eq("status", status);
  if (reference) query = query.ilike("order_groups.reference", `%${reference.replace(/[\\%_]/g, "\\$&")}%`);

  const { data, count, error } = await query;
  if (error) throw error;

  return { orders: data, total: count ?? 0 };
}

export async function listAllProducts(search: string, page: number, moderatedOnly = false) {
  const supabase = await createClient();
  const from = (page - 1) * ORDER_PAGE_SIZE;

  let query = supabase
    .from("products")
    .select(
      "id, title, status, publication_status, price_millimes, moderated_at, shops (name)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, from + ORDER_PAGE_SIZE - 1);

  query = moderatedOnly
    ? query.not("moderated_at", "is", null)
    : query.eq("publication_status", "published");

  if (search) {
    query = query.ilike("search_text", `%${search.toLowerCase().replace(/[\\%_]/g, "\\$&")}%`);
  }

  const { data, count, error } = await query;
  if (error) throw error;

  return { products: data, total: count ?? 0 };
}

export type ShipmentStatus =
  | "ordered"
  | "confirmed"
  | "preparing"
  | "handed_over"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "failed"
  | "returned"
  | "cancelled";

// Suivi d'une commande : le colis (livraison seulement) et l'historique des étapes.
export async function getShipment(orderId: string) {
  const supabase = await createClient();
  const [{ data: shipment }, { data: events }] = await Promise.all([
    supabase
      .from("shipments")
      .select("order_id, tracking_code, status, carrier, courier_name, courier_phone, latitude, longitude, position_at, eta")
      .eq("order_id", orderId)
      .maybeSingle(),
    supabase
      .from("shipment_events")
      .select("id, status, source, note, created_at")
      .eq("order_id", orderId)
      .order("id"),
  ]);

  return {
    shipment: shipment ? { ...shipment, status: shipment.status as ShipmentStatus } : null,
    events: (events ?? []).map((event) => ({ ...event, status: event.status as ShipmentStatus })),
  };
}

// La grille effective, gouvernorat par gouvernorat : ce que voient boutiques et clients.
export async function getDeliveryPriceList() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delivery_price_list");
  if (error) throw error;
  return data;
}

// Réservé à l'administration : la grille enregistrée et le tarif par défaut.
export async function getPlatformDeliverySettings() {
  const supabase = await createClient();
  const [{ data: rates, error }, { data: setting }] = await Promise.all([
    supabase.from("delivery_zone_rates").select("governorate_id, fee_millimes"),
    supabase.from("platform_settings").select("value").eq("key", "default_delivery_fee_millimes").maybeSingle(),
  ]);

  if (error) throw error;

  return {
    defaultMillimes: Number(setting?.value ?? 8000),
    rates: new Map(rates.map((rate) => [rate.governorate_id, rate.fee_millimes])),
  };
}

export async function listRecentShipments(limit = 50) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shipments")
    .select("order_id, tracking_code, status, courier_name, updated_at, orders (total_millimes, shops (name), order_groups (reference, recipient_name))")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}
