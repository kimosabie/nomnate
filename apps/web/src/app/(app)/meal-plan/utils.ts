export function currentWeekStart(): string {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun … 6=Sat in UTC
  const toMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + toMonday);
  return monday.toISOString().split("T")[0];
}
