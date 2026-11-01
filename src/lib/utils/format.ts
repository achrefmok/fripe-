const TIME_ZONE = "Africa/Tunis";

function intlLocale(locale: string) {
  return locale === "ar" ? "ar-TN" : "fr-TN";
}

export function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: "medium",
    timeZone: TIME_ZONE,
  }).format(new Date(value));
}

export function formatDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    dateStyle: "short",
    timeStyle: "short",
    hourCycle: "h23",
    timeZone: TIME_ZONE,
  }).format(new Date(value));
}

export function formatDuration(minutes: number, locale: string) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const format = (value: number, unit: "hour" | "minute") =>
    new Intl.NumberFormat(intlLocale(locale), { style: "unit", unit, unitDisplay: "long" }).format(value);

  return [hours ? format(hours, "hour") : null, rest ? format(rest, "minute") : null]
    .filter(Boolean)
    .join(" ");
}

export function localizedName(item: { name_fr: string; name_ar: string }, locale: string) {
  return locale === "ar" ? item.name_ar : item.name_fr;
}
