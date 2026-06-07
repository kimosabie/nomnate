"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { filterText } from "@/lib/contentFilter";
import { toCourse } from "@nomnate/types";
import { suggestEventMenu } from "@nomnate/lib/claude";
import { checkRateLimit } from "@/lib/rateLimit";

export type EventRow = {
  id: string;
  name: string;
  event_type: string | null;
  event_date: string | null;
  guest_count: number;
};

export type EventDish = {
  id: string;
  recipe_id: string | null;
  course: string;
  label: string;
};

const EVENT_TYPES = ["braai", "party", "dinner", "other"];

function cleanEventType(value: unknown): string | null {
  const v = typeof value === "string" ? value.toLowerCase().trim() : "";
  return EVENT_TYPES.includes(v) ? v : null;
}

function cleanGuests(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return 4;
  return Math.min(Math.round(n), 500);
}

function cleanEventDate(value: unknown): string | null {
  const v = typeof value === "string" ? value : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

async function resolveFamily(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: member } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  return member ? { userId: user.id, familyId: member.family_id } : null;
}

export async function listEvents(): Promise<{ error: string } | { events: EventRow[] }> {
  const supabase = await createClient();
  const ctx = await resolveFamily(supabase);
  if (!ctx) return { error: "No family found" };

  const { data, error } = await supabase
    .from("events")
    .select("id, name, event_type, event_date, guest_count")
    .eq("family_id", ctx.familyId)
    .order("event_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) return { error: error.message };
  return { events: (data ?? []) as EventRow[] };
}

export async function getEvent(
  id: string
): Promise<{ error: string } | { event: EventRow; dishes: EventDish[] }> {
  const supabase = await createClient();
  const ctx = await resolveFamily(supabase);
  if (!ctx) return { error: "No family found" };

  const { data: event } = await supabase
    .from("events")
    .select("id, name, event_type, event_date, guest_count, family_id")
    .eq("id", id)
    .maybeSingle();
  if (!event || event.family_id !== ctx.familyId) return { error: "Event not found" };

  const { data: dishes } = await supabase
    .from("event_dishes")
    .select("id, recipe_id, course, label")
    .eq("event_id", id)
    .order("created_at", { ascending: true });

  return {
    event: {
      id: event.id,
      name: event.name,
      event_type: event.event_type,
      event_date: event.event_date,
      guest_count: event.guest_count,
    },
    dishes: (dishes ?? []) as EventDish[],
  };
}

export async function createEvent(input: {
  name: string;
  eventType?: string | null;
  eventDate?: string | null;
  guestCount?: number;
}): Promise<{ error: string } | { id: string }> {
  const supabase = await createClient();
  const ctx = await resolveFamily(supabase);
  if (!ctx) return { error: "No family found" };

  const nf = filterText(input.name ?? "", 80);
  if (nf.error) return { error: nf.error };
  if (!nf.value) return { error: "Give the event a name" };

  const { data: saved, error } = await supabase
    .from("events")
    .insert({
      family_id: ctx.familyId,
      name: nf.value,
      event_type: cleanEventType(input.eventType),
      event_date: cleanEventDate(input.eventDate),
      guest_count: cleanGuests(input.guestCount),
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  if (error || !saved) return { error: error?.message ?? "Failed to create event" };

  revalidatePath("/events");
  return { id: saved.id };
}

export async function updateEvent(
  id: string,
  input: { name?: string; eventType?: string | null; eventDate?: string | null; guestCount?: number }
): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient();
  const ctx = await resolveFamily(supabase);
  if (!ctx) return { error: "No family found" };

  const patch: {
    name?: string;
    event_type?: string | null;
    event_date?: string | null;
    guest_count?: number;
  } = {};
  if (input.name !== undefined) {
    const nf = filterText(input.name, 80);
    if (nf.error) return { error: nf.error };
    if (!nf.value) return { error: "Give the event a name" };
    patch.name = nf.value;
  }
  if (input.eventType !== undefined) patch.event_type = cleanEventType(input.eventType);
  if (input.eventDate !== undefined) patch.event_date = cleanEventDate(input.eventDate);
  if (input.guestCount !== undefined) patch.guest_count = cleanGuests(input.guestCount);
  if (Object.keys(patch).length === 0) return { ok: true };

  const { error } = await supabase
    .from("events")
    .update(patch)
    .eq("id", id)
    .eq("family_id", ctx.familyId);
  if (error) return { error: error.message };

  revalidatePath(`/events/${id}`);
  revalidatePath("/events");
  return { ok: true };
}

export async function deleteEvent(id: string): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient();
  const ctx = await resolveFamily(supabase);
  if (!ctx) return { error: "No family found" };

  const { error } = await supabase
    .from("events")
    .delete()
    .eq("id", id)
    .eq("family_id", ctx.familyId);
  if (error) return { error: error.message };

  revalidatePath("/events");
  return { ok: true };
}

export async function addDishFromRecipe(
  eventId: string,
  recipeId: string,
  course: string
): Promise<{ error: string } | { dish: EventDish }> {
  const supabase = await createClient();
  const ctx = await resolveFamily(supabase);
  if (!ctx) return { error: "No family found" };

  // Verify the event belongs to the caller's family
  const { data: event } = await supabase
    .from("events")
    .select("id, family_id")
    .eq("id", eventId)
    .maybeSingle();
  if (!event || event.family_id !== ctx.familyId) return { error: "Event not found" };

  // Verify the recipe is accessible (global or family-owned) + snapshot its title
  const { data: recipe } = await supabase
    .from("recipes")
    .select("id, title, is_global, family_id, course")
    .eq("id", recipeId)
    .maybeSingle();
  if (!recipe) return { error: "Recipe not found" };
  if (!recipe.is_global && recipe.family_id !== ctx.familyId) return { error: "Recipe not found" };

  const dishCourse = toCourse(course) ?? (recipe.course ? toCourse(recipe.course) : null) ?? "main";

  const { data: saved, error } = await supabase
    .from("event_dishes")
    .insert({ event_id: eventId, recipe_id: recipe.id, course: dishCourse, label: recipe.title })
    .select("id, recipe_id, course, label")
    .single();
  if (error || !saved) return { error: error?.message ?? "Failed to add dish" };

  revalidatePath(`/events/${eventId}`);
  return { dish: saved as EventDish };
}

// Generate a themed AI menu for the event: saves each dish as a global recipe
// (NOT added to family_recipes, so it doesn't count against the meal-plan AI
// budget) and links it as an event dish. Returns the new dishes.
export async function generateEventMenu(
  eventId: string
): Promise<{ error: string } | { dishes: EventDish[] }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const ctx = await resolveFamily(supabase);
  if (!ctx) return { error: "No family found" };

  const { data: event } = await supabase
    .from("events")
    .select("id, family_id, event_type, guest_count")
    .eq("id", eventId)
    .maybeSingle();
  if (!event || event.family_id !== ctx.familyId) return { error: "Event not found" };

  const ok = await checkRateLimit(supabase, user.id, "ai_event_menu", 3, 60);
  if (!ok) return { error: "Too many menu generations — wait a moment before trying again." };

  const { data: family } = await supabase
    .from("families")
    .select("country, cuisine_preferences, dietary_requirements")
    .eq("id", ctx.familyId)
    .maybeSingle();

  let menu;
  try {
    menu = await suggestEventMenu({
      eventType: event.event_type ?? "other",
      guests: event.guest_count,
      country: (family as { country?: string } | null)?.country,
      cuisinePreferences: (family as { cuisine_preferences?: string[] } | null)?.cuisine_preferences ?? [],
      dietaryRequirements: (family as { dietary_requirements?: string[] } | null)?.dietary_requirements ?? [],
    });
  } catch {
    return { error: "AI menu generation is temporarily unavailable — please try again later." };
  }
  if (!menu.length) return { error: "No menu returned — try again." };

  const created: EventDish[] = [];
  for (const dish of menu) {
    const { data: recipe, error: recErr } = await supabase
      .from("recipes")
      .insert({
        title: dish.title,
        source: "ai" as const,
        source_attribution: `AI-generated recipe by Claude (Anthropic). Inspired by traditional ${dish.cuisine} cooking.`,
        instructions: dish.instructions,
        prep_time: dish.prep_time ?? null,
        servings: dish.servings,
        cuisine: dish.cuisine,
        course: dish.course,
        calories_per_serving: dish.calories_per_serving ?? null,
        protein_g: dish.protein_g ?? null,
        carbs_g: dish.carbs_g ?? null,
        fat_g: dish.fat_g ?? null,
        nutrition_estimated: true,
        is_global: true,
        created_by: user.id,
      })
      .select("id, title")
      .single();
    if (recErr || !recipe) continue;

    if (dish.ingredients?.length) {
      await supabase.from("recipe_ingredients").insert(
        dish.ingredients.map((ing) => ({
          recipe_id: recipe.id,
          name: ing.name,
          quantity: ing.quantity ?? null,
          unit: ing.unit || null,
        }))
      );
    }

    const { data: savedDish } = await supabase
      .from("event_dishes")
      .insert({ event_id: eventId, recipe_id: recipe.id, course: dish.course, label: recipe.title })
      .select("id, recipe_id, course, label")
      .single();
    if (savedDish) created.push(savedDish as EventDish);
  }

  if (created.length === 0) return { error: "Could not save the generated menu — try again." };

  revalidatePath(`/events/${eventId}`);
  return { dishes: created };
}

export async function removeDish(dishId: string): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient();
  const ctx = await resolveFamily(supabase);
  if (!ctx) return { error: "No family found" };

  // RLS already restricts to the caller's family; delete by id.
  const { error } = await supabase.from("event_dishes").delete().eq("id", dishId);
  if (error) return { error: error.message };

  revalidatePath("/events");
  return { ok: true };
}
