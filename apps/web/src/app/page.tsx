import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-cream flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto w-full">
        <span className="font-display text-[22px] font-medium leading-none tracking-tight">
          <span className="text-flame">Nom</span>
          <span className="text-herb">Nate</span>
        </span>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-slate hover:text-charcoal transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="text-sm font-semibold px-5 py-2 rounded-full bg-flame text-white hover:bg-flame-dark transition-colors"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center text-center px-6 py-20 max-w-4xl mx-auto w-full">
        <div className="inline-flex items-center gap-2 bg-flame-light text-flame-dark text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
          <span>✨</span>
          <span>AI-powered family meal planning</span>
        </div>
        <h1 className="text-5xl sm:text-6xl font-display font-medium text-charcoal tracking-tight mb-5 leading-tight">
          Family dinner,<br />
          <span className="text-flame">decided together.</span>
        </h1>
        <p className="text-lg text-slate mb-8 max-w-xl mx-auto leading-relaxed">
          Plan the week together, vote on meals, get AI suggestions, and generate
          organised shopping lists for Woolworths, Pick&nbsp;n&nbsp;Pay and Checkers.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/signup"
            className="px-6 py-3 rounded-full bg-flame text-white font-semibold hover:bg-flame-dark transition-colors"
          >
            Start for free
          </Link>
          <Link
            href="/login"
            className="px-6 py-3 rounded-full border border-cream-border text-slate font-semibold hover:bg-white transition-colors"
          >
            Log in
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="bg-white border-t border-cream-border px-6 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-display font-medium text-charcoal text-center mb-2">
            Built for South African families
          </h2>
          <p className="text-sm text-slate text-center mb-10">
            From the weekly plan to the trolley — everything in one place.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: "📅",
                title: "Weekly meal plan",
                desc: "Map out the week at a glance. Swap meals with a tap.",
              },
              {
                icon: "❤️",
                title: "Family voting",
                desc: "Love it, yes or no — everyone has a say at dinner.",
              },
              {
                icon: "✨",
                title: "AI suggestions",
                desc: "Claude suggests meals based on your family's tastes and restrictions.",
              },
              {
                icon: "🛒",
                title: "SA shopping lists",
                desc: "Assign items to Woolworths, PnP or Checkers and copy the list.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="bg-cream-warm rounded-[14px] p-5 border border-cream-border"
              >
                <div className="text-3xl mb-3">{f.icon}</div>
                <p className="font-semibold text-charcoal mb-1 text-sm">{f.title}</p>
                <p className="text-xs text-slate leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-16 max-w-4xl mx-auto w-full">
        <h2 className="text-2xl font-display font-medium text-charcoal text-center mb-10">
          How it works
        </h2>
        <div className="grid sm:grid-cols-3 gap-8">
          {[
            {
              step: "1",
              title: "Create your family",
              desc: "Set up a family group and invite everyone. Each member sets their own taste preferences and dietary needs.",
            },
            {
              step: "2",
              title: "Plan the week",
              desc: "Browse recipes, get AI suggestions, or add your own. Everyone votes, and the meal plan comes together.",
            },
            {
              step: "3",
              title: "Shop with ease",
              desc: "Generate a shopping list sorted by store. Assign items to Woolworths, PnP or Checkers and tick them off as you go.",
            },
          ].map((s) => (
            <div key={s.step} className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-flame text-white text-sm font-bold flex items-center justify-center shrink-0">
                {s.step}
              </div>
              <div>
                <p className="font-semibold text-charcoal mb-1 text-sm">{s.title}</p>
                <p className="text-sm text-slate leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA strip */}
      <section className="bg-flame px-6 py-14 text-center">
        <h2 className="text-2xl font-display font-medium text-white mb-3">
          Ready to take the stress out of dinner?
        </h2>
        <p className="text-flame-light text-sm mb-6">
          Free to get started. No credit card required.
        </p>
        <Link
          href="/signup"
          className="inline-block px-6 py-3 rounded-full bg-white text-flame font-semibold hover:bg-cream transition-colors"
        >
          Create your family →
        </Link>
      </section>

      {/* Footer */}
      <footer className="px-6 py-6 text-center text-xs text-slate bg-white border-t border-cream-border">
        &copy; 2026 NomNate &mdash; Made for South African families
      </footer>
    </main>
  );
}
