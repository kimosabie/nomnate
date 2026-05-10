"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/(auth)/actions";

const LINKS = [
  { href: "/dashboard", label: "Home" },
  { href: "/recipes", label: "Recipes" },
  { href: "/meal-plan", label: "Meal plan" },
  { href: "/shopping-list", label: "Shopping" },
];

export function AppNav({ initials }: { initials: string }) {
  const pathname = usePathname();

  return (
    <header className="bg-white border-b border-cream-border sticky top-0 z-40">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
        <Link href="/dashboard" className="shrink-0 mr-1">
          <span className="font-display text-[22px] font-medium leading-none tracking-tight">
            <span className="text-flame">Nom</span>
            <span className="text-herb">Nate</span>
          </span>
        </Link>

        <nav className="flex items-center flex-1 min-w-0">
          {LINKS.map(({ href, label }) => {
            const isActive =
              pathname === href ||
              (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`px-2.5 py-1.5 rounded-full text-[13px] font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? "text-flame"
                    : "text-slate hover:text-charcoal"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <form action={signOut} className="shrink-0">
          <button
            type="submit"
            className="w-8 h-8 rounded-full bg-flame text-white text-xs font-semibold flex items-center justify-center hover:bg-flame-dark transition-colors"
            title="Sign out"
          >
            {initials}
          </button>
        </form>
      </div>
    </header>
  );
}
