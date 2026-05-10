export function getWeekStart(): string {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun
  const toMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + toMonday);
  return monday.toISOString().split("T")[0];
}

// day_of_week: 0=Mon … 6=Sun (matches web)
export function todayDow(): number {
  const day = new Date().getUTCDay();
  return day === 0 ? 6 : day - 1;
}

export function weekDates(): { dow: number; label: string; date: number }[] {
  const monday = new Date();
  const day = monday.getUTCDay();
  monday.setUTCDate(monday.getUTCDate() + (day === 0 ? -6 : 1 - day));
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return days.map((label, i) => {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    return { dow: i, label, date: d.getUTCDate() };
  });
}
