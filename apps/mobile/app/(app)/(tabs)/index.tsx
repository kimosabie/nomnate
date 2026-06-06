import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { supabase } from "@/src/lib/supabase";
import { colors, spacing, radius, typography, shadows } from "@nomnate/ui";
import { getWeekStart, todayDow, weekDates } from "@/src/lib/utils";

type Recipe = { title: string; image_url: string | null };
type Slot = {
  id: string;
  day_of_week: number;
  option_number: number;
  status: string;
  recipe_id: string | null;
  recipes: Recipe | null;
};
type Vote = { meal_plan_slot_id: string; member_id: string; value: string };

export default function MealPlanScreen() {
  const [memberId, setMemberId] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [hasPlan, setHasPlan] = useState<boolean | null>(null);
  const [selectedDow, setSelectedDow] = useState(todayDow());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [voting, setVoting] = useState<string | null>(null);

  const days = weekDates();

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: member } = await supabase
      .from("family_members")
      .select("id, family_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (!member) return;

    setMemberId(member.id);

    const { data: plan } = await supabase
      .from("meal_plans")
      .select("id")
      .eq("family_id", member.family_id)
      .eq("week_start_date", getWeekStart())
      .maybeSingle();

    if (!plan) {
      setHasPlan(false);
      return;
    }

    setHasPlan(true);

    const { data: slotData } = await supabase
      .from("meal_plan_slots")
      .select("id, day_of_week, option_number, status, recipe_id, recipes(title, image_url)")
      .eq("meal_plan_id", plan.id)
      .order("day_of_week")
      .order("option_number");

    const loadedSlots = (slotData ?? []) as Slot[];
    setSlots(loadedSlots);

    const ids = loadedSlots.map((s) => s.id);
    if (ids.length > 0) {
      const { data: voteData } = await supabase
        .from("votes")
        .select("meal_plan_slot_id, member_id, value")
        .in("meal_plan_slot_id", ids);
      setVotes((voteData ?? []) as Vote[]);
    }
  }, []);

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  async function castVote(slotId: string, value: string) {
    if (!memberId || voting) return;
    setVoting(slotId + value);

    const existing = votes.find(
      (v) => v.meal_plan_slot_id === slotId && v.member_id === memberId
    );

    if (existing?.value === value) {
      // Undo vote
      await supabase
        .from("votes")
        .delete()
        .eq("meal_plan_slot_id", slotId)
        .eq("member_id", memberId);
      setVotes((prev) =>
        prev.filter((v) => !(v.meal_plan_slot_id === slotId && v.member_id === memberId))
      );
    } else {
      // Upsert vote
      await supabase.from("votes").upsert(
        { meal_plan_slot_id: slotId, member_id: memberId, value },
        { onConflict: "meal_plan_slot_id,member_id" }
      );
      setVotes((prev) => [
        ...prev.filter((v) => !(v.meal_plan_slot_id === slotId && v.member_id === memberId)),
        { meal_plan_slot_id: slotId, member_id: memberId, value },
      ]);
    }

    setVoting(null);
  }

  const daySlots = slots.filter((s) => s.day_of_week === selectedDow);

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
        <Text style={styles.weekLabel}>This week</Text>
      </View>

      {/* Day strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dayStrip}
      >
        {days.map(({ dow, label, date }) => {
          const isToday = dow === todayDow();
          const isSelected = dow === selectedDow;
          const hasSlots = slots.some((s) => s.day_of_week === dow);
          return (
            <TouchableOpacity
              key={dow}
              onPress={() => setSelectedDow(dow)}
              style={[
                styles.dayBtn,
                isSelected && styles.dayBtnSelected,
                isToday && !isSelected && styles.dayBtnToday,
              ]}
            >
              <Text style={[styles.dayLabel, isSelected && styles.dayLabelSelected]}>
                {label}
              </Text>
              <Text style={[styles.dateNum, isSelected && styles.dayLabelSelected]}>
                {date}
              </Text>
              {hasSlots && <View style={[styles.dot, isSelected && styles.dotSelected]} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {hasPlan === false ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>📅</Text>
            <Text style={styles.emptyTitle}>No meal plan yet</Text>
            <Text style={styles.emptyText}>
              Open the NomNate web app to generate this week&apos;s meal plan.
            </Text>
          </View>
        ) : daySlots.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🍽️</Text>
            <Text style={styles.emptyTitle}>Nothing planned</Text>
            <Text style={styles.emptyText}>No meals added for this day yet.</Text>
          </View>
        ) : (
          daySlots.map((slot) => {
            const slotVotes = votes.filter((v) => v.meal_plan_slot_id === slot.id);
            const myVote = slotVotes.find((v) => v.member_id === memberId)?.value ?? null;
            const countFor = (val: string) => slotVotes.filter((v) => v.value === val).length;

            return (
              <View key={slot.id} style={styles.card}>
                {slot.recipes?.image_url ? (
                  <Image
                    source={{ uri: slot.recipes.image_url }}
                    style={styles.recipeImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.recipeImage, styles.imagePlaceholder]}>
                    <Text style={{ fontSize: 40 }}>🍳</Text>
                  </View>
                )}

                <View style={styles.cardBody}>
                  <Text style={styles.optionLabel}>Option {slot.option_number}</Text>
                  <Text style={styles.recipeTitle}>
                    {slot.recipes?.title ?? "Recipe removed"}
                  </Text>

                  <View style={styles.voteRow}>
                    {(["love", "up", "down"] as const).map((val) => {
                      const emoji = val === "love" ? "❤️" : val === "up" ? "👍" : "👎";
                      const count = countFor(val);
                      const isActive = myVote === val;
                      const isLoading = voting === slot.id + val;
                      return (
                        <TouchableOpacity
                          key={val}
                          onPress={() => castVote(slot.id, val)}
                          disabled={!!voting}
                          style={[styles.voteBtn, isActive && styles.voteBtnActive]}
                        >
                          {isLoading ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                          ) : (
                            <>
                              <Text style={styles.voteEmoji}>{emoji}</Text>
                              {count > 0 && (
                                <Text style={[styles.voteCount, isActive && styles.voteCountActive]}>
                                  {count}
                                </Text>
                              )}
                            </>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  logo: { fontSize: typography.sizes.xl, fontWeight: "700", color: colors.primary },
  weekLabel: { fontSize: typography.sizes.sm, color: colors.text.secondary },
  dayStrip: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dayBtn: {
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
    minWidth: 44,
    gap: 2,
  },
  dayBtnToday: { backgroundColor: "#FFF0E8" },
  dayBtnSelected: { backgroundColor: colors.primary },
  dayLabel: { fontSize: 11, fontWeight: "600", color: colors.text.secondary, textTransform: "uppercase" },
  dateNum: { fontSize: typography.sizes.md, fontWeight: "700", color: colors.text.primary },
  dayLabelSelected: { color: "#fff" },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.primary, marginTop: 1 },
  dotSelected: { backgroundColor: "#fff" },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyEmoji: { fontSize: 48, marginBottom: spacing.sm },
  emptyTitle: { fontSize: typography.sizes.lg, fontWeight: "600", color: colors.text.primary, marginBottom: spacing.xs },
  emptyText: { fontSize: typography.sizes.sm, color: colors.text.secondary, textAlign: "center" },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    ...shadows.card,
  },
  recipeImage: { width: "100%", height: 160 },
  imagePlaceholder: { backgroundColor: "#FFF0E8", alignItems: "center", justifyContent: "center" },
  cardBody: { padding: spacing.md },
  optionLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.text.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  recipeTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: "600",
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  voteRow: { flexDirection: "row", gap: spacing.sm },
  voteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#F9FAFB",
    minWidth: 52,
    justifyContent: "center",
  },
  voteBtnActive: {
    backgroundColor: "#FFF0E8",
    borderColor: colors.primary,
  },
  voteEmoji: { fontSize: 18 },
  voteCount: { fontSize: typography.sizes.sm, fontWeight: "600", color: colors.text.secondary },
  voteCountActive: { color: colors.primary },
});
