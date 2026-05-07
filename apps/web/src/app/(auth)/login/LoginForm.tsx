"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn } from "../actions";

export function LoginForm() {
  const [error, formAction, pending] = useActionState(signIn, null);

  return (
    <form action={formAction} className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">Welcome back</h2>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">
          {error}
        </p>
      )}

      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@family.com"
          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>

      <p className="text-center text-sm text-gray-500">
        No account?{" "}
        <Link
          href="/signup"
          className="text-orange-500 hover:underline font-medium"
        >
          Sign up
        </Link>
      </p>
    </form>
  );
}
