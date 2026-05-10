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
  diet_types: string[];
}

interface FamilyData {
  id: string;
  name: string;
  invite_code: string;
  members: Member[];
}

export default function ProfileScreen() {
  const [family, setFamily] = useState<FamilyData | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFamily();
  }, []);

  async function loadFamily() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: membership } = await supabase
      .from("family_members")
      .select("id, family:families(id, name, invite_code)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!membership?.family) return setLoading(false);

    const f = membership.family as { id: string; name: string; invite_code: string };
    setMyId(membership.id);

    const { data: members } = await supabase
      .from("family_members")
      .select("id, name, role, dietary_restrictions, diet_types")
      .eq("family_id", f.id)
      .order("joined_at");

    setFamily({ ...f, members: members ?? [] });
    setLoading(false);
  }

  async function shareInvite() {
    if (!family) return;
    await Share.share({
      message: `Join the ${family.name} family on NomNate!\n\nUse invite code: ${family.invite_code}\n\nDownload NomNate to get started.`,
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
        <Text style={styles.title}>Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Family card */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Your family</Text>
          <Text style={styles.familyName}>{family?.name ?? "—"}</Text>

          <View style={styles.inviteRow}>
            <View>
              <Text style={styles.cardLabel}>Invite code</Text>
              <Text style={styles.inviteCode}>{family?.invite_code}</Text>
            </View>
            <TouchableOpacity style={styles.shareButton} onPress={shareInvite}>
              <Text style={styles.shareButtonText}>Share invite</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Members */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Members ({family?.members.length ?? 0})
          </Text>
          {family?.members.map((m) => {
            const isMe = m.id === myId;
            const tags = [
              ...((m.dietary_restrictions as string[]) ?? []),
              ...((m.diet_types as string[]) ?? []),
            ];
            return (
              <View key={m.id} style={styles.memberRow}>
                <View style={[styles.avatar, isMe && styles.avatarMe]}>
                  <Text style={styles.avatarText}>
                    {(m.name ?? "?")[0].toUpperCase()}
                  </Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>
                    {m.name ?? "Unnamed"}
                    {m.role === "admin" && <Text style={styles.adminBadge}> · admin</Text>}
                    {isMe && <Text style={styles.meBadge}> · you</Text>}
                  </Text>
                  {tags.length > 0 && (
                    <Text style={styles.dietary} numberOfLines={1}>
                      {tags.join(", ")}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>

        <Text style={styles.footerNote}>
          To manage preferences or delete your account, visit{"\n"}nomnate.app/profile
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { justifyContent: "center", alignItems: "center" },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: typography.sizes.xl, fontWeight: "700", color: colors.primary },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.text.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  familyName: {
    fontSize: typography.sizes.xxl,
    fontWeight: "700",
    color: colors.text.primary,
  },
  inviteRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: spacing.xs,
  },
  inviteCode: {
    fontSize: typography.sizes.xl,
    fontWeight: "700",
    color: colors.text.primary,
    letterSpacing: 4,
    fontFamily: Platform.OS === "ios" ? "Courier-Bold" : "monospace",
    marginTop: 4,
  },
  shareButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  shareButtonText: { color: "#fff", fontWeight: "600", fontSize: typography.sizes.sm },
  sectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: "600",
    color: colors.text.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  memberRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFF0E8",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarMe: { backgroundColor: colors.primary },
  avatarText: { color: colors.primary, fontWeight: "700", fontSize: typography.sizes.sm },
  memberInfo: { flex: 1 },
  memberName: { fontSize: typography.sizes.sm, fontWeight: "500", color: colors.text.primary },
  adminBadge: { color: colors.text.muted, fontWeight: "400" },
  meBadge: { color: colors.primary, fontWeight: "400" },
  dietary: { fontSize: 11, color: colors.text.muted, marginTop: 2 },
  signOutBtn: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  signOutText: { fontSize: typography.sizes.sm, fontWeight: "600", color: "#DC2626" },
  footerNote: {
    textAlign: "center",
    fontSize: typography.sizes.xs,
    color: colors.text.muted,
    lineHeight: 18,
  },
});
