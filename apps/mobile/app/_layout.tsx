import { useEffect } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { supabase } from "@/src/lib/supabase";
import type { Session, AuthChangeEvent } from "@supabase/supabase-js";

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        const inAuthGroup = segments[0] === "(auth)";

        if (session && inAuthGroup) {
          router.replace("/(app)");
        } else if (!session && !inAuthGroup) {
          router.replace("/(auth)/login");
        }
      }
    );

    return () => listener.subscription.unsubscribe();
  }, [segments, router]);

  return (
    <>
      <StatusBar style="auto" />
      <Slot />
    </>
  );
}
