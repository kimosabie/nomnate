import { useEffect, useState } from "react";
import { Stack, useRouter } from "expo-router";
import { supabase } from "@/src/lib/supabase";

export default function AppLayout() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    async function checkFamily() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("family_members")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      setChecked(true);
      if (!data) router.replace("/(app)/onboarding");
    }
    checkFamily();
  }, [router]);

  if (!checked) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" />
    </Stack>
  );
}
