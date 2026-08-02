/**
 * Formato estable SSR/CSR (evita hydration mismatch de Intl am/pm / espacios).
 * Zona: Argentina.
 */
export function formatDateTimeAr(value: string | null | undefined): string {
  if (!value) {
    return "sin actividad";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "sin actividad";
  }

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("day")}/${get("month")} ${get("hour")}:${get("minute")}`;
}
