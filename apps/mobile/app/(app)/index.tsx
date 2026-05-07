import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Share,
  ActivityIndicator,
  Platform,
} from "react-native";
import { supabase } from "@/src/lib/supabase";
import { colors, spacing, radius, typography } from "@nomnate/ui";

interface Member {
  id: string;
  name: string | null;
  role: string;
  dietary_restrictions: string[];
}

interface FamilyData {
  id: string;
  name: string;
  invite_code: string;
  members: Member[];
}

export default function HomeScreen() {
  const [family, setFamily] = useState<FamilyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFamily();
  }, []);

  async function loadFamily() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: membership } = await supabase
      .from("family_members")
      .select("family:families(id, name, invite_code)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!membership?.family) return setLoading(false);

    const f = membership.family as { id: string; name: string; invite_code: string };

    const { data: members } = await supabase
      .from("family_members")
      .select("id, name, role, dietary_restrictions")
      .eq("family_id", f.id)
      .order("joined_at");

    setFamily({ ...f, members: members ?? [] });
    setLoading(false);
  }

  async function shareInvite() {
    if (!family) return;
    await Share.share({
      message: `Join our family on NomNate! Use code: ${family.invite_code}`,
    });
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>NomNate</Text>
        <TouchableOpacity onPress={handleSignOut}>
          <Text style={styles.signOut}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Family card */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Your family</Text>
          <Text style={styles.familyName}>{family?.name}</Text>

          <View style={styles.inviteRow}>
            <View>
              <Text style={styles.cardLabel}>Invite code</Text>
              <Text style={styles.inviteCode}>{family?.invite_code}</Text>
            </View>
            <TouchableOpacity style={styles.shareButton} onPress={shareInvite}>
              <Text style={styles.shareButtonText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Members */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Members ({family?.members.length ?? 0})
          </Text>
          {family?.members.map((m) => (
            <View key={m.id} style={styles.memberRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(m.name ?? "?")[0].toUpperCase()}
                </Text>
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>
                  {m.name ?? "Unnamed"}
                  {m.role === "admin" && (
                    <Text style={styles.adminBadge}> admin</Text>
                  )}
                </Text>
                {m.dietary_restrictions?.length > 0 && (
                  <Text style={styles.dietary}>
                    {m.dietary_restrictions.join(", ")}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Meal plan CTA */}
        <View style={styles.ctaCard}>
          <Text style={styles.ctaWeek}>This week</Text>
          <Text style={styles.ctaTitle}>Ready to plan your meals?</Text>
          <View style={styles.ctaButton}>
            <Text style={styles.ctaButtonText}>Coming soon — meal planning</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  logo: { fontSize: typography.sizes.xl, fontWeight: "700", color: colors.primary },
  signOut: { fontSize: typography.sizes.sm, color: colors.text.secondary },
  content: { padding: spacing.lg, gap: spacing.md },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.lg, borderWidth: 1, borderColor: colors.border,
  },
  cardLabel: {
    fontSize: 11, fontWeight: "600", color: colors.text.muted,
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4,
  },
  familyName: {
    fontSize: typography.sizes.xxl, fontWeight: "700",
    color: colors.text.primary, marginBottom: spacing.md,
  },
  inviteRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  inviteCode: {
    fontSize: typography.sizes.xl, fontWeight: "700",
    color: colors.text.primary, letterSpacing: 4,
    fontFamily: Platform.OS === "ios" ? "Courier-Bold" : "monospace",
  },
  shareButton: {
    backgroundColor: colors.primary, borderRadius: radius.sm,
    paddingHorizontal: spacing.md, paddingVertical: 8,
  },
  shareButtonText: { color: "#fff", fontWeight: "600", fontSize: typography.sizes.sm },
  sectionTitle: {
    fontSize: typography.sizes.sm, fontWeight: "600",
    color: colors.text.secondary, marginBottom: spacing.md,
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  memberRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.sm },
  avatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: "#FFF0E8",
    alignItems: "center", justifyContent: "center", marginRight: spacing.sm,
  },
  avatarText: { color: colors.primary, fontWeight: "700", fontSize: typography.sizes.sm },
  memberInfo: { flex: 1 },
  memberName: { fontSize: typography.sizes.sm, fontWeight: "500", color: colors.text.primary },
  adminBadge: { color: colors.primary, fontWeight: "400" },
  dietary: { fontSize: 11, color: colors.text.muted, marginTop: 2 },
  ctaCard: { backgroundColor: colors.primary, borderRadius: radius.lg, padding: spacing.lg },
  ctaWeek: { fontSize: typography.sizes.sm, color: "rgba(255,255,255,0.7)", marginBottom: 4 },
  ctaTitle: { fontSize: typography.sizes.lg, fontWeight: "700", color: "#fff", marginBottom: spacing.md },
  ctaButton: {
    backgroundColor: "#fff", borderRadius: radius.sm,
    paddingHorizontal: spacing.md, paddingVertical: 10, alignSelf: "flex-start", opacity: 0.7,
  },
  ctaButtonText: { color: colors.primary, fontWeight: "600", fontSize: typography.sizes.sm },
});

