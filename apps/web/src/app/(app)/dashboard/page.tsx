import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { signOut } from "../../(auth)/actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-xl font-bold text-orange-500">NomNate</span>
          <form action={signOut}>
            <button
              type="submit"
              className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Hey there 👋
        </h1>
        <p className="text-gray-500 text-sm mb-8">{user.email}</p>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center text-gray-400">
          <p className="text-4xl mb-3">🍽️</p>
          <p className="font-medium text-gray-600">
            Your meal plan is on its way.
          </p>
          <p className="text-sm mt-1">
            Next: create or join your family to start planning.
          </p>
        </div>
      </div>
    </main>
  );
}
