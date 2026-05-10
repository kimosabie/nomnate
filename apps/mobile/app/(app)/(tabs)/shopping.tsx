import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Share,
} from "react-native";
import { supabase } from "@/src/lib/supabase";
import { colors, spacing, radius, typography } from "@nomnate/ui";
import { getWeekStart } from "@/src/lib/utils";

type Item = {
  id: string;
  ingredient_name: string;
  quantity: number | null;
  unit: string | null;
  store: string | null;
  checked: boolean;
};

const STORE_ORDER = ["woolworths", "pnp", "checkers", "other"] as const;
const STORE_LABELS: Record<string, string> = {
  woolworths: "Woolworths",
  pnp: "Pick n Pay",
  checkers: "Checkers",
  other: "Other",
};
const STORE_EMOJI: Record<string, string> = {
  woolworths: "🌿",
  pnp: "🔴",
  checkers: "🏪",
  other: "🛒",
};

export default function ShoppingScreen() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasList, setHasList] = useState<boolean | null>(null);

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: member } = await supabase
      .from("family_members")
      .select("family_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (!member) return;

    const { data: plan } = await supabase
      .from("meal_plans")
      .select("id")
      .eq("family_id", member.family_id)
      .eq("week_start_date", getWeekStart())
      .maybeSingle();

    if (!plan) { setHasList(false); return; }

    const { data: list } = await supabase
      .from("shopping_lists")
      .select("id")
      .eq("meal_plan_id", plan.id)
      .maybeSingle();

    if (!list) { setHasList(false); return; }

    setHasList(true);

    const { data } = await supabase
      .from("shopping_list_items")
      .select("id, ingredient_name, quantity, unit, store, checked")
      .eq("list_id", list.id)
      .order("ingredient_name");

    setItems((data ?? []) as Item[]);
  }, []);

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  async function onRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  async function toggleItem(id: string) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const newChecked = !item.checked;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, checked: newChecked } : i)));
    await supabase.from("shopping_list_items").update({ checked: newChecked }).eq("id", id);
  }

  async function shareStore(store: string) {
    const storeItems = items.filter((i) => (i.store ?? "other") === store && !i.checked);
    if (!storeItems.length) return;
    const lines = storeItems.map((i) => {
      const qty = i.quantity ? `${i.quantity}${i.unit ? ` ${i.unit}` : ""} ` : "";
      return `• ${qty}${i.ingredient_name}`;
    });
    await Share.share({
      message: `${STORE_LABELS[store] ?? store} shopping list:\n${lines.join("\n")}`,
    });
  }

  const grouped = STORE_ORDER.map((store) => ({
    store,
    items: items.filter((i) => (i.store ?? "other") === store),
  })).filter((g) => g.items.length > 0);

  const uncheckedCount = items.filter((i) => !i.checked).length;

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
        <View>
          <Text style={styles.title}>Shopping List</Text>
          {hasList && (
            <Text style={styles.subtitle}>{uncheckedCount} item{uncheckedCount !== 1 ? "s" : ""} remaining</Text>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {hasList === false ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🛒</Text>
            <Text style={styles.emptyTitle}>No shopping list yet</Text>
            <Text style={styles.emptyText}>
              Generate a shopping list from your meal plan on the NomNate web app.
            </Text>
          </View>
        ) : grouped.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>✅</Text>
            <Text style={styles.emptyTitle}>All done!</Text>
            <Text style={styles.emptyText}>Nothing left on the shopping list.</Text>
          </View>
        ) : (
          grouped.map(({ store, items: storeItems }) => {
            const unchecked = storeItems.filter((i) => !i.checked);
            return (
              <View key={store} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleRow}>
                    <Text style={styles.storeEmoji}>{STORE_EMOJI[store]}</Text>
                    <Text style={styles.storeName}>{STORE_LABELS[store] ?? store}</Text>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{storeItems.length}</Text>
                    </View>
                  </View>
                  {unchecked.length > 0 && (
                    <TouchableOpacity onPress={() => shareStore(store)} style={styles.shareBtn}>
                      <Text style={styles.shareBtnText}>Share</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.card}>
                  {storeItems.map((item, idx) => (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => toggleItem(item.id)}
                      style={[
                        styles.itemRow,
                        idx < storeItems.length - 1 && styles.itemRowBorder,
                      ]}
                      activeOpacity={0.6}
                    >
                      <View style={[styles.checkbox, item.checked && styles.checkboxChecked]}>
                        {item.checked && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                      <Text style={[styles.itemName, item.checked && styles.itemNameChecked]}>
                        {item.ingredient_name}
                      </Text>
                      {(item.quantity || item.unit) && (
                        <Text style={styles.itemQty}>
                          {item.quantity ?? ""}{item.unit ? ` ${item.unit}` : ""}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))}
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
    alignItems: "flex-end",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: typography.sizes.xl, fontWeight: "700", color: colors.primary },
  subtitle: { fontSize: typography.sizes.sm, color: colors.text.secondary, marginTop: 2 },
  content: { padding: spacing.md, gap: spacing.lg, paddingBottom: spacing.xl },
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
  section: { gap: spacing.sm },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  storeEmoji: { fontSize: 18 },
  storeName: { fontSize: typography.sizes.md, fontWeight: "700", color: colors.text.primary },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: "center",
  },
  badgeText: { fontSize: 11, fontWeight: "700", color: "#fff" },
  shareBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  shareBtnText: { fontSize: typography.sizes.xs, fontWeight: "500", color: colors.text.secondary },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    gap: spacing.sm,
  },
  itemRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkmark: { color: "#fff", fontSize: 13, fontWeight: "700" },
  itemName: { flex: 1, fontSize: typography.sizes.sm, color: colors.text.primary, textTransform: "capitalize" },
  itemNameChecked: { color: colors.text.muted, textDecorationLine: "line-through" },
  itemQty: { fontSize: typography.sizes.xs, color: colors.text.muted, flexShrink: 0 },
});
