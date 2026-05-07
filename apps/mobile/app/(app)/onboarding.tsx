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
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/src/lib/supabase";
import { colors, spacing, radius, typography } from "@nomnate/ui";

type Tab = "create" | "join";

export default function OnboardingScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("create");
  const [displayName, setDisplayName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    setError(null);
    if (!displayName.trim()) return setError("Your name is required");
    if (!familyName.trim()) return setError("Family name is required");

    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: family, error: familyErr } = await supabase
      .from("families")
      .insert({ name: familyName.trim(), created_by: user.id })
      .select()
      .single();

    if (familyErr) {
      setLoading(false);
      return setError(familyErr.message);
    }

    await supabase
      .from("family_members")
      .update({ name: displayName.trim() })
      .eq("family_id", family.id)
      .eq("user_id", user.id);

    setLoading(false);
    router.replace("/(app)");
  }

  async function handleJoin() {
    setError(null);
    if (!displayName.trim()) return setError("Your name is required");
    if (!inviteCode.trim()) return setError("Invite code is required");

    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: family, error: lookupErr } = await supabase
      .from("families")
      .select("id")
      .eq("invite_code", inviteCode.trim().toUpperCase())
      .single();

    if (lookupErr || !family) {
      setLoading(false);
      return setError("Invalid invite code — double-check and try again");
    }

    const { error: joinErr } = await supabase
      .from("family_members")
      .insert({ family_id: family.id, user_id: user.id, name: displayName.trim() });

    setLoading(false);
    if (joinErr) return setError(joinErr.message);
    router.replace("/(app)");
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>NomNate</Text>
        <Text style={styles.tagline}>Set up your family</Text>

        <View style={styles.card}>
          {/* Tab toggle */}
          <View style={styles.tabs}>
            {(["create", "join"] as Tab[]).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.tab, tab === t && styles.tabActive]}
                onPress={() => { setTab(t); setError(null); }}
              >
                <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                  {t === "create" ? "Create family" : "Join family"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Your name</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="e.g. Mum"
              placeholderTextColor={colors.text.muted}
            />
          </View>

          {tab === "create" ? (
            <View style={styles.field}>
              <Text style={styles.label}>Family name</Text>
              <TextInput
                style={styles.input}
                value={familyName}
                onChangeText={setFamilyName}
                placeholder="e.g. The Ormistons"
                placeholderTextColor={colors.text.muted}
              />
            </View>
          ) : (
            <View style={styles.field}>
              <Text style={styles.label}>Invite code</Text>
              <TextInput
                style={[styles.input, styles.monoInput]}
                value={inviteCode}
                onChangeText={(t) => setInviteCode(t.toUpperCase())}
                placeholder="A1B2C3D4"
                placeholderTextColor={colors.text.muted}
                autoCapitalize="characters"
                maxLength={8}
              />
              <Text style={styles.hint}>Ask your family admin for their 8-letter code</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={tab === "create" ? handleCreate : handleJoin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {tab === "create" ? "Create family" : "Join family"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF7F3" },
  inner: { flexGrow: 1, justifyContent: "center", padding: spacing.lg },
  logo: {
    fontSize: 36, fontWeight: "700", color: colors.primary, textAlign: "center",
  },
  tagline: {
    fontSize: typography.sizes.sm, color: colors.text.secondary,
    textAlign: "center", marginTop: spacing.xs, marginBottom: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.lg, shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06,
    shadowRadius: 8, elevation: 2,
  },
  tabs: {
    flexDirection: "row", backgroundColor: "#F3F4F6",
    borderRadius: radius.sm, padding: 4, marginBottom: spacing.md, gap: 4,
  },
  tab: {
    flex: 1, paddingVertical: 8, borderRadius: 6, alignItems: "center",
  },
  tabActive: { backgroundColor: colors.surface, shadowColor: "#000", shadowOpacity: 0.06, elevation: 1 },
  tabText: { fontSize: typography.sizes.sm, color: colors.text.secondary, fontWeight: "500" },
  tabTextActive: { color: colors.text.primary },
  errorBox: {
    backgroundColor: "#FEF2F2", borderRadius: radius.sm,
    padding: spacing.sm, marginBottom: spacing.md,
  },
  errorText: { color: "#DC2626", fontSize: typography.sizes.sm },
  field: { marginBottom: spacing.md },
  label: {
    fontSize: typography.sizes.sm, fontWeight: "500",
    color: colors.text.primary, marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    fontSize: typography.sizes.sm, color: colors.text.primary,
  },
  monoInput: { fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", letterSpacing: 4 },
  hint: { fontSize: 11, color: colors.text.muted, marginTop: 4 },
  button: {
    backgroundColor: colors.primary, borderRadius: radius.sm,
    paddingVertical: 12, alignItems: "center", marginTop: spacing.xs,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: typography.sizes.md },
});
