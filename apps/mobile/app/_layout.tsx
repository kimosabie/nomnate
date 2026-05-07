import { useEffect } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { supabase } from "@/src/lib/supabase";

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
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
