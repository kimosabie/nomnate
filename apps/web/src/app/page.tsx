import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-white flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto w-full">
        <span className="text-2xl font-extrabold text-orange-500 tracking-tight">
          NomNate
        </span>
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="text-sm font-semibold px-4 py-2 rounded-xl bg-orange-500 text-white hover:bg-orange-600 transition-colors shadow-sm"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center text-center px-6 py-20 max-w-4xl mx-auto w-full">
        <div className="inline-flex items-center gap-2 bg-orange-50 text-orange-600 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
          <span>✨</span>
          <span>AI-powered family meal planning</span>
        </div>
        <h1 className="text-5xl sm:text-6xl font-extrabold text-gray-900 tracking-tight mb-5 leading-tight">
          Dinner sorted.<br />
          <span className="text-orange-500">Everyone happy.</span>
        </h1>
        <p className="text-lg text-gray-500 mb-8 max-w-xl mx-auto leading-relaxed">
          Plan the week together, vote on meals, get AI suggestions, and generate
          organised shopping lists for Woolworths, Pick&nbsp;n&nbsp;Pay and Checkers.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/signup"
            className="px-6 py-3 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 transition-colors shadow-sm"
          >
            Start for free
          </Link>
          <Link
            href="/login"
            className="px-6 py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
          >
            Log in
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 border-t border-gray-100 px-6 py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
            Built for South African families
          </h2>
          <p className="text-sm text-gray-500 text-center mb-10">
            From the weekly plan to the trolley — everything in one place.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                icon: "📅",
                title: "Weekly meal plan",
                desc: "Map out the week at a glance. Swap meals with a tap.",
              },
              {
                icon: "♥",
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
                className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
              >
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-1 text-sm">{f.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-16 max-w-4xl mx-auto w-full">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">
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
              <div className="w-8 h-8 rounded-full bg-orange-500 text-white text-sm font-bold flex items-center justify-center shrink-0">
                {s.step}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA strip */}
      <section className="bg-orange-500 px-6 py-14 text-center">
        <h2 className="text-2xl font-bold text-white mb-3">
          Ready to take the stress out of dinner?
        </h2>
        <p className="text-orange-100 text-sm mb-6">
          Free to get started. No credit card required.
        </p>
        <Link
          href="/signup"
          className="inline-block px-6 py-3 rounded-xl bg-white text-orange-600 font-semibold hover:bg-orange-50 transition-colors shadow-sm"
        >
          Create your family &rarr;
        </Link>
      </section>

      {/* Footer */}
      <footer className="px-6 py-6 text-center text-xs text-gray-400 bg-white border-t border-gray-100">
        &copy; 2026 NomNate &mdash; Made for South African families
      </footer>
    </main>
  );
}
