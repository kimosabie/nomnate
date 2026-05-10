import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
// Handles email confirmation, magic link, and OAuth callbacks
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as "signup" | "recovery" | "email" | "invite" | null;
  const rawNext = searchParams.get("next") ?? "/dashboard";

  // Prevent open redirect: only allow same-origin relative paths
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : "/dashboard";

  const supabase = await createClient();

  // PKCE flow (OAuth, magic link)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Email confirmation / OTP flow
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      // New signups land on onboarding; existing users go to next param or dashboard
      const destination = type === "signup" ? "/onboarding" : next;
      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
