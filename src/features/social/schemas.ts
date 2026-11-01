import { z } from "zod";
import { parsePriceToMillimes } from "@/lib/utils/price";

const list = z
  .string()
  .trim()
  .transform((value) =>
    value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, 10),
  );

export const dropAlertSchema = z.object({
  name: z.string().trim().min(2, "nameTooShort").max(60, "nameTooLong"),
  sizes: list,
  brands: list,
  categoryIds: z.array(z.uuid()).max(10),
  shopIds: z.array(z.uuid()).max(10),
  followedOnly: z.boolean(),
  budget: z
    .string()
    .trim()
    .transform((value, context) => {
      if (value === "") return null;

      const millimes = parsePriceToMillimes(value);
      if (millimes === null) {
        context.addIssue({ code: "custom", message: "priceInvalid" });
        return z.NEVER;
      }

      return millimes;
    }),
});

export const preferencesSchema = z.object({
  inAppEnabled: z.boolean(),
  maxPerDay: z.coerce.number().int().min(1).max(50),
});
