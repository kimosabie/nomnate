import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from "react-native";
import { supabase } from "@/src/lib/supabase";
import { colors, spacing, radius, typography } from "@nomnate/ui";
import type { User } from "@supabase/supabase-js";

export default function HomeScreen() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>NomNate</Text>
        <TouchableOpacity onPress={handleSignOut}>
          <Text style={styles.signOut}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.greeting}>Hey there 👋</Text>
        {user && <Text style={styles.email}>{user.email}</Text>}

        <View style={styles.placeholder}>
          <Text style={styles.placeholderEmoji}>🍽️</Text>
          <Text style={styles.placeholderTitle}>
            Your meal plan is on its way.
          </Text>
          <Text style={styles.placeholderSub}>
            Next: create or join your family to start planning.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  logo: {
    fontSize: typography.sizes.xl,
    fontWeight: "700",
    color: colors.primary,
  },
  signOut: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  greeting: {
    fontSize: typography.sizes.xl,
    fontWeight: "700",
    color: colors.text.primary,
  },
  email: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  placeholder: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  placeholderEmoji: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  placeholderTitle: {
    fontSize: typography.sizes.md,
    fontWeight: "600",
    color: colors.text.primary,
    textAlign: "center",
  },
  placeholderSub: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: spacing.xs,
  },
});
