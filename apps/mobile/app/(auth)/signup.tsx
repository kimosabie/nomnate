import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Link } from "expo-router";
import { supabase } from "@/src/lib/supabase";
import { colors, spacing, radius, typography } from "@nomnate/ui";

export default function SignupScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignUp() {
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) setError(error.message);
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.inner}>
        <Text style={styles.logo}>NomNate</Text>
        <Text style={styles.tagline}>Family meals, decided together</Text>

        <View style={styles.card}>
          <Text style={styles.title}>Create account</Text>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="you@family.com"
              placeholderTextColor={colors.text.muted}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
              placeholder="At least 8 characters"
              placeholderTextColor={colors.text.muted}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignUp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Create account</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.footerText}>
            Already have an account?{" "}
            <Link href="/(auth)/login" style={styles.link}>
              Sign in
            </Link>
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF7F3",
  },
  inner: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg,
  },
  logo: {
    fontSize: 36,
    fontWeight: "700",
    color: colors.primary,
    textAlign: "center",
  },
  tagline: {
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: "600",
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  errorBox: {
    backgroundColor: "#FEF2F2",
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  errorText: {
    color: "#DC2626",
    fontSize: typography.sizes.sm,
  },
  field: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: "500",
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: typography.sizes.sm,
    color: colors.text.primary,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: spacing.xs,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: typography.sizes.md,
  },
  footerText: {
    textAlign: "center",
    fontSize: typography.sizes.sm,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  link: {
    color: colors.primary,
    fontWeight: "500",
  },
});
