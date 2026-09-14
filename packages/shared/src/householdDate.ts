/** Match families.timezone's default for missing or invalid settings. */
export function householdToday(timezone?: string | null, now = new Date()): string {
  let formatter: Intl.DateTimeFormat;
  const options = { year: "numeric", month: "2-digit", day: "2-digit" } as const;
  try { formatter = new Intl.DateTimeFormat("en-CA", { ...options, timeZone: timezone || "Africa/Johannesburg" }); }
  catch { formatter = new Intl.DateTimeFormat("en-CA", { ...options, timeZone: "Africa/Johannesburg" }); }
  const parts = formatter.formatToParts(now);
  return ["year", "month", "day"].map((type) => parts.find((p) => p.type === type)!.value).join("-");
}
export function validDinnerDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "0001-01-01") return false;
  const parsed = new Date(value + "T12:00:00Z");
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
/** Calendar arithmetic after resolving the household date; independent of host TZ. */
export function dinnerWeek(date: string) {
  if (!validDinnerDate(date)) throw new Error("Choose a valid dinner date");
  const day = new Date(date + "T12:00:00Z");
  const dayOfWeek = (day.getUTCDay() + 6) % 7;
  day.setUTCDate(day.getUTCDate() - dayOfWeek);
  return { weekStart: day.toISOString().slice(0, 10), dayOfWeek };
}
export function dinnerDateLabel(date: string): string {
  return new Intl.DateTimeFormat("en-ZA", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(date + "T12:00:00Z"));
}
