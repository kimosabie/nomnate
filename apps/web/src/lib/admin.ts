import "server-only";

// Who can view the admin area (system health + metrics).
//
// - ADMIN_EMAIL  — the primary "headless" admin. The (app) layout redirects this
//   account straight to /admin/dashboard (it has no family).
// - ADMIN_EMAILS — optional comma-separated list of additional admins who use the
//   app normally (have a family) but can also reach the admin pages + see the
//   admin link on their profile. They are NOT redirected.
export function adminEmails(): string[] {
  const primary = process.env.ADMIN_EMAIL ? [process.env.ADMIN_EMAIL] : [];
  const extra = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  return [...primary, ...extra].map((e) => e.toLowerCase());
}

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}
