"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { signOut } from "@/app/(auth)/actions";

const LINKS = [
  { href: "/dashboard", label: "Home" },
  { href: "/recipes", label: "Recipes" },
  { href: "/meal-plan", label: "Meal plan" },
  { href: "/shopping-list", label: "Shopping" },
  { href: "/food-log", label: "Diary" },
];

export function AppNav({ initials, inviteCode, isAdmin }: { initials: string; inviteCode: string | null; isAdmin?: boolean }) {
  const pathname = usePathname();
  const [codeCopied, setCodeCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  function copyCode() {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  return (
    <header className="bg-white border-b border-cream-border sticky top-0 z-40 print:hidden">
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

        {inviteCode && (
          <button
            onClick={copyCode}
            title={codeCopied ? "Copied!" : "Copy invite code"}
            className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border border-[#F5D5C0] bg-[#FFF3EE] text-slate hover:text-charcoal transition-colors shrink-0"
          >
            <span className="font-mono tracking-wider">{inviteCode}</span>
            <span>{codeCopied ? "✓" : "📋"}</span>
          </button>
        )}

        <div className="relative shrink-0" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="w-8 h-8 rounded-full bg-flame text-white text-xs font-semibold flex items-center justify-center hover:bg-flame-dark transition-colors"
            title="Account menu"
          >
            {initials}
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-10 w-44 bg-white border border-cream-border rounded-xl shadow-lg py-1 z-50"
              onMouseLeave={() => setMenuOpen(false)}
            >
              <Link
                href="/profile"
                onClick={() => setMenuOpen(false)}
                className="block px-4 py-2 text-sm text-charcoal hover:bg-cream transition-colors"
              >
                Preferences
              </Link>
              <Link
                href="/family"
                onClick={() => setMenuOpen(false)}
                className="block px-4 py-2 text-sm text-charcoal hover:bg-cream transition-colors"
              >
                Family settings
              </Link>
              {isAdmin && (
                <Link
                  href="/admin/dashboard"
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-2 text-sm font-semibold text-charcoal hover:bg-cream transition-colors border-t border-cream-border mt-1 pt-2"
                >
                  Admin dashboard
                </Link>
              )}
              <div className="border-t border-cream-border mt-1 pt-1">
                <form action={signOut}>
                  <button
                    type="submit"
                    className="w-full text-left px-4 py-2 text-sm text-slate hover:text-charcoal hover:bg-cream transition-colors"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
