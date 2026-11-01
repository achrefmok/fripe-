// Tous les montants sont des entiers en millimes : 1 DT = 1 000 millimes.
const MAX_MILLIMES = 100_000_000;

export function parsePriceToMillimes(value: string): number | null {
  const match = value.trim().match(/^(\d{1,6})(?:[.,](\d{1,3}))?$/);
  if (!match) return null;

  const millimes = Number(match[1]) * 1000 + Number((match[2] ?? "").padEnd(3, "0"));
  return millimes > 0 && millimes <= MAX_MILLIMES ? millimes : null;
}

export function millimesToInput(millimes: number | null | undefined) {
  if (millimes == null) return "";

  const whole = Math.floor(millimes / 1000);
  const fraction = millimes % 1000;
  return fraction ? `${whole},${String(fraction).padStart(3, "0").replace(/0+$/, "")}` : String(whole);
}

export function formatPrice(millimes: number, locale: string) {
  const amount = new Intl.NumberFormat(locale === "ar" ? "ar-TN" : "fr-TN", {
    minimumFractionDigits: millimes % 1000 ? 3 : 0,
    maximumFractionDigits: 3,
  }).format(millimes / 1000);

  return locale === "ar" ? `${amount} د.ت` : `${amount} DT`;
}
