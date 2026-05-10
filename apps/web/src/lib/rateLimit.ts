// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = { from: (...args: any[]) => any };

/**
 * Checks and increments a per-user rate limit bucket stored in Supabase.
 * Returns true if the request is allowed, false if the limit is exceeded.
 *
 * Uses read-then-upsert — suitable for low-concurrency pre-pilot use.
 */
export async function checkRateLimit(
  supabase: AnySupabaseClient,
  userId: string,
  action: string,
  limit: number,
  windowMinutes: number
): Promise<boolean> {
  const ms = windowMinutes * 60 * 1000;
  const windowStart = new Date(Math.floor(Date.now() / ms) * ms).toISOString();

  const { data } = await supabase
    .from("rate_limits")
    .select("count")
    .eq("user_id", userId)
    .eq("action", action)
    .eq("window_start", windowStart)
    .maybeSingle();

  const current = data?.count ?? 0;
  if (current >= limit) return false;

  await supabase.from("rate_limits").upsert(
    { user_id: userId, action, window_start: windowStart, count: current + 1 },
    { onConflict: "user_id,action,window_start" }
  );

  return true;
}
