import Link from "next/link";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-cream-border bg-white">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="font-display text-2xl font-medium leading-none">
            <span className="text-flame">Nom</span>
            <span className="text-herb">Nate</span>
          </Link>
          <nav className="flex items-center gap-4 text-xs text-slate">
            <Link href="/privacy" className="hover:text-flame transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-flame transition-colors">Terms</Link>
            <Link href="/cookies" className="hover:text-flame transition-colors">Cookies</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10">
        <article className="
          text-charcoal text-sm leading-relaxed
          [&_h1]:font-display [&_h1]:text-2xl [&_h1]:font-medium [&_h1]:text-flame [&_h1]:mb-2
          [&_h2]:font-semibold [&_h2]:text-base [&_h2]:text-charcoal [&_h2]:mt-8 [&_h2]:mb-2
          [&_p]:mb-4 [&_p]:text-slate
          [&_ul]:mb-4 [&_ul]:pl-5 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:text-slate
          [&_li]:leading-relaxed
          [&_a]:text-flame [&_a]:underline
          [&_strong]:text-charcoal [&_strong]:font-semibold
          [&_table]:w-full [&_table]:text-sm [&_table]:border-collapse [&_table]:mb-4
          [&_th]:text-left [&_th]:py-2 [&_th]:pr-4 [&_th]:font-semibold [&_th]:border-b [&_th]:border-cream-border
          [&_td]:py-2 [&_td]:pr-4 [&_td]:align-top [&_td]:border-b [&_td]:border-cream-border
        ">
          {children}
        </article>
      </main>

      <footer className="border-t border-cream-border mt-12">
        <div className="max-w-2xl mx-auto px-4 py-6 text-xs text-slate flex flex-wrap gap-4">
          <Link href="/privacy" className="hover:text-flame transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-flame transition-colors">Terms of Service</Link>
          <Link href="/cookies" className="hover:text-flame transition-colors">Cookie Policy</Link>
          <span className="ml-auto">© {new Date().getFullYear()} NomNate</span>
        </div>
      </footer>
    </div>
  );
}
