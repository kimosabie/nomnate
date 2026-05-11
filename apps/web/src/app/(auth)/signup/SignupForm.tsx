"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUp } from "../actions";

export function SignupForm() {
  const [error, formAction, pending] = useActionState(signUp, null);

  const inputClass =
    "w-full px-4 py-2.5 border border-cream-border rounded-xl text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-flame focus:border-transparent placeholder:text-slate";

  return (
    <form action={formAction} className="space-y-4">
      <h2 className="text-xl font-semibold text-charcoal">Create account</h2>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">
          {error}
        </p>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-charcoal mb-1">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@family.com"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-charcoal mb-1">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          placeholder="At least 8 characters"
          className={inputClass}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-flame hover:bg-flame-dark disabled:opacity-60 text-white font-semibold py-2.5 rounded-full text-sm transition-colors"
      >
        {pending ? "Creating account…" : "Create account"}
      </button>

      <p className="text-center text-xs text-slate leading-relaxed">
        By creating an account you agree to our{" "}
        <Link href="/terms" className="text-flame hover:underline">Terms of Service</Link>
        {" "}and{" "}
        <Link href="/privacy" className="text-flame hover:underline">Privacy Policy</Link>.
      </p>

      <p className="text-center text-sm text-slate">
        Already have an account?{" "}
        <Link href="/login" className="text-flame hover:underline font-medium">
          Sign in
        </Link>
      </p>
    </form>
  );
}
