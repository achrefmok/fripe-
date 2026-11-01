import { z } from "zod";
import { parsePriceToMillimes } from "@/lib/utils/price";

export const inventoryItemSchema = z.object({
  categoryId: z.uuid("categoryRequired"),
  label: z.string().trim().max(80, "textTooLong"),
  approxQuantity: z.coerce.number("quantityInvalid").int("quantityInvalid").min(0, "quantityInvalid").max(1000000, "quantityInvalid"),
});

export const stockRequestSchema = z.object({
  categoryId: z.union([z.uuid(), z.literal("")]),
  size: z.string().trim().max(20, "textTooLong"),
  color: z.string().trim().max(40, "textTooLong"),
  brand: z.string().trim().max(60, "textTooLong"),
  budget: z
    .string()
    .trim()
    .transform((value, context) => {
      if (value === "") return 0;

      const millimes = parsePriceToMillimes(value);
      if (millimes === null) {
        context.addIssue({ code: "custom", message: "priceInvalid" });
        return z.NEVER;
      }

      return millimes;
    }),
  message: z.string().trim().min(3, "messageTooShort").max(500, "textTooLong"),
});

export const offerSchema = z.object({
  requestId: z.uuid(),
  productId: z.uuid("productRequired"),
  message: z.string().trim().max(300, "textTooLong"),
});
