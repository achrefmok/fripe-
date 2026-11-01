import { z } from "zod";
import { normalizeTunisianPhone } from "@/lib/validations/common";

export const checkoutSchema = z
  .object({
    productIds: z.array(z.uuid()).min(1).max(50),
    pickupShopIds: z.array(z.uuid()).max(50),
    recipientName: z.string().trim().min(2, "nameTooShort").max(80, "nameTooLong"),
    phone: z
      .string()
      .trim()
      .transform((value, context) => {
        const phone = normalizeTunisianPhone(value);
        if (!phone) {
          context.addIssue({ code: "custom", message: "phoneInvalid" });
          return z.NEVER;
        }

        return phone;
      }),
    governorateId: z.coerce.number().int().min(0),
    cityId: z.coerce.number().int().min(0),
    addressLine: z.string().trim().max(200, "textTooLong"),
    needsAddress: z.boolean(),
    expectedTotal: z.number().int().nonnegative().nullable(),
  })
  .superRefine((value, context) => {
    if (!value.needsAddress) return;

    if (!value.governorateId || !value.cityId) {
      context.addIssue({ code: "custom", path: ["cityId"], message: "locationRequired" });
    }

    if (value.addressLine.length < 5) {
      context.addIssue({ code: "custom", path: ["addressLine"], message: "addressRequired" });
    }
  });

export const cancelOrderSchema = z.object({
  orderId: z.uuid(),
  reason: z.string().trim().max(300, "textTooLong"),
});

export const ORDER_FLOW = {
  delivery: ["pending", "confirmed", "preparing", "shipped", "delivered"],
  pickup: ["pending", "confirmed", "preparing", "delivered"],
} as const;

export function nextOrderStatus(status: string, fulfillment: "delivery" | "pickup") {
  const flow: readonly string[] = ORDER_FLOW[fulfillment];
  const index = flow.indexOf(status);
  return index >= 0 && index < flow.length - 1 ? flow[index + 1] : null;
}
