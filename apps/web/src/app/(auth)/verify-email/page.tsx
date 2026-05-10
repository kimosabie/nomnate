import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Verify your email — NomNate" };

export default function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  return (
    <div className="text-center space-y-4">
      <div className="w-14 h-14 rounded-[14px] bg-flame-light flex items-center justify-center text-3xl mx-auto">
        ✉️
      </div>

      <div>
        <h2 className="text-xl font-semibold text-charcoal mb-1">Check your email</h2>
        <p className="text-sm text-slate">
          We&apos;ve sent a confirmation link to your inbox. Click it to activate your
          account and get started.
        </p>
      </div>

      <div className="bg-cream rounded-xl px-4 py-3 text-xs text-slate text-left space-y-1">
        <p>✓ Check your spam or junk folder if you don&apos;t see it.</p>
        <p>✓ The link expires after 24 hours.</p>
      </div>

      <p className="text-xs text-slate pt-2">
        Wrong email?{" "}
        <Link href="/signup" className="text-flame hover:underline font-medium">
          Sign up again
        </Link>
        {" · "}
        <Link href="/login" className="text-flame hover:underline font-medium">
          Sign in
        </Link>
      </p>
    </div>
  );
}
