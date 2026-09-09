export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      dinner_drafts: {
        Row: {
          id: string
          family_id: string
          created_by: string | null
          status: "open" | "finalised" | "cancelled"
          draft_type: "tonight" | "weekly"
          week_start: string | null
          expires_at: string | null
          created_at: string
          updated_at: string
          winner_candidate_id: string | null
          finalised_at: string | null
          result: Json | null
        }
        Insert: {
          id?: string
          family_id: string
          created_by?: string | null
          status?: "open" | "finalised" | "cancelled"
          draft_type?: "tonight" | "weekly"
          week_start?: string | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
          winner_candidate_id?: string | null
          finalised_at?: string | null
          result?: Json | null
        }
        Update: {
          id?: string
          family_id?: string
          created_by?: string | null
          status?: "open" | "finalised" | "cancelled"
          draft_type?: "tonight" | "weekly"
          week_start?: string | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
          winner_candidate_id?: string | null
          finalised_at?: string | null
          result?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "dinner_draft_winner_belongs_to_draft"
            columns: ["id", "winner_candidate_id"]
            isOneToOne: false
            referencedRelation: "draft_candidates"
            referencedColumns: ["draft_id", "id"]
          },
          {
            foreignKeyName: "dinner_drafts_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_candidates: {
        Row: {
          id: string
          draft_id: string
          recipe_id: string | null
          recipe_snapshot: Json
          target_date: string | null
          course: "starter" | "main" | "dessert" | "side" | null
          nomination_source: "planner" | "library" | "ai"
          display_order: number
          created_at: string
        }
        Insert: {
          id?: string
          draft_id: string
          recipe_id?: string | null
          recipe_snapshot?: Json
          target_date?: string | null
          course?: "starter" | "main" | "dessert" | "side" | null
          nomination_source?: "planner" | "library" | "ai"
          display_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          draft_id?: string
          recipe_id?: string | null
          recipe_snapshot?: Json
          target_date?: string | null
          course?: "starter" | "main" | "dessert" | "side" | null
          nomination_source?: "planner" | "library" | "ai"
          display_order?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "draft_candidates_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "dinner_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_candidates_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      draft_votes: {
        Row: {
          id: string
          candidate_id: string
          family_member_id: string
          reaction: "love" | "eat" | "whatever" | "nope"
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          candidate_id: string
          family_member_id: string
          reaction: "love" | "eat" | "whatever" | "nope"
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          candidate_id?: string
          family_member_id?: string
          reaction?: "love" | "eat" | "whatever" | "nope"
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "draft_votes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "draft_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "draft_votes_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          created_at: string
          family_id: string
          id: string
          kind: string
        }
        Insert: {
          created_at?: string
          family_id: string
          id?: string
          kind?: string
        }
        Update: {
          created_at?: string
          family_id?: string
          id?: string
          kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          created_by: string | null
          event_date: string | null
          event_type: string | null
          family_id: string
          guest_count: number
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_date?: string | null
          event_type?: string | null
          family_id: string
          guest_count?: number
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_date?: string | null
          event_type?: string | null
          family_id?: string
          guest_count?: number
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      event_dishes: {
        Row: {
          course: string
          created_at: string
          event_id: string
          id: string
          label: string
          recipe_id: string | null
        }
        Insert: {
          course?: string
          created_at?: string
          event_id: string
          id?: string
          label: string
          recipe_id?: string | null
        }
        Update: {
          course?: string
          created_at?: string
          event_id?: string
          id?: string
          label?: string
          recipe_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_dishes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_dishes_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          timezone: string
          cuisine_preferences: string[]
          dietary_requirements: string[]
          country: string
          courses: string[]
          created_at: string
          created_by: string
          id: string
          invite_code: string
          name: string
          preferred_stores: string[]
        }
        Insert: {
          timezone?: string
          cuisine_preferences?: string[]
          dietary_requirements?: string[]
          country?: string
          courses?: string[]
          created_at?: string
          created_by: string
          id?: string
          invite_code?: string
          name: string
          preferred_stores?: string[]
        }
        Update: {
          timezone?: string
          cuisine_preferences?: string[]
          dietary_requirements?: string[]
          country?: string
          courses?: string[]
          created_at?: string
          created_by?: string
          id?: string
          invite_code?: string
          name?: string
          preferred_stores?: string[]
        }
        Relationships: []
      }
      family_members: {
        Row: {
          age: number | null
          allergies: string[]
          avatar_url: string | null
          cuisine_preferences: string[]
          daily_calorie_target: number | null
          date_of_birth: string | null
          diet_types: string[]
          dietary_restrictions: string[]
          family_id: string
          id: string
          ingredient_dislikes: string[]
          joined_at: string
          liked_ingredients: string[]
          name: string | null
          relationship: string | null
          role: string
          track_calories: boolean
          user_id: string
        }
        Insert: {
          age?: number | null
          allergies?: string[]
          avatar_url?: string | null
          cuisine_preferences?: string[]
          daily_calorie_target?: number | null
          date_of_birth?: string | null
          diet_types?: string[]
          dietary_restrictions?: string[]
          family_id: string
          id?: string
          ingredient_dislikes?: string[]
          joined_at?: string
          liked_ingredients?: string[]
          name?: string | null
          relationship?: string | null
          role?: string
          track_calories?: boolean
          user_id: string
        }
        Update: {
          age?: number | null
          allergies?: string[]
          avatar_url?: string | null
          cuisine_preferences?: string[]
          daily_calorie_target?: number | null
          date_of_birth?: string | null
          diet_types?: string[]
          dietary_restrictions?: string[]
          family_id?: string
          id?: string
          ingredient_dislikes?: string[]
          joined_at?: string
          liked_ingredients?: string[]
          name?: string | null
          relationship?: string | null
          role?: string
          track_calories?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      food_log_entries: {
        Row: {
          calories: number | null
          carbs_g: number | null
          created_at: string
          family_member_id: string
          fat_g: number | null
          id: string
          label: string
          logged_date: string
          meal_type: string | null
          nutrition_estimated: boolean
          protein_g: number | null
          recipe_id: string | null
          servings: number
        }
        Insert: {
          calories?: number | null
          carbs_g?: number | null
          created_at?: string
          family_member_id: string
          fat_g?: number | null
          id?: string
          label: string
          logged_date: string
          meal_type?: string | null
          nutrition_estimated?: boolean
          protein_g?: number | null
          recipe_id?: string | null
          servings?: number
        }
        Update: {
          calories?: number | null
          carbs_g?: number | null
          created_at?: string
          family_member_id?: string
          fat_g?: number | null
          id?: string
          label?: string
          logged_date?: string
          meal_type?: string | null
          nutrition_estimated?: boolean
          protein_g?: number | null
          recipe_id?: string | null
          servings?: number
        }
        Relationships: [
          {
            foreignKeyName: "food_log_entries_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_log_entries_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          ai_category: string | null
          ai_summary: string | null
          approved: boolean | null
          created_at: string
          id: string
          message: string
          page_url: string
          priority: string | null
          reviewed: boolean | null
          type: string
          user_id: string | null
        }
        Insert: {
          ai_category?: string | null
          ai_summary?: string | null
          approved?: boolean | null
          created_at?: string
          id?: string
          message: string
          page_url?: string
          priority?: string | null
          reviewed?: boolean | null
          type: string
          user_id?: string | null
        }
        Update: {
          ai_category?: string | null
          ai_summary?: string | null
          approved?: boolean | null
          created_at?: string
          id?: string
          message?: string
          page_url?: string
          priority?: string | null
          reviewed?: boolean | null
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action: string
          count: number
          user_id: string
          window_start: string
        }
        Insert: {
          action: string
          count?: number
          user_id: string
          window_start: string
        }
        Update: {
          action?: string
          count?: number
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      todo_items: {
        Row: {
          approved: boolean | null
          approved_at: string | null
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          priority: string | null
          source_feedback_ids: string[] | null
          title: string
        }
        Insert: {
          approved?: boolean | null
          approved_at?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          priority?: string | null
          source_feedback_ids?: string[] | null
          title: string
        }
        Update: {
          approved?: boolean | null
          approved_at?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          priority?: string | null
          source_feedback_ids?: string[] | null
          title?: string
        }
        Relationships: []
      }
      meal_plan_slots: {
        Row: {
          committed_draft_id: string | null
          course: string
          day_of_week: number
          id: string
          meal_plan_id: string
          option_number: number
          recipe_id: string | null
          status: string
        }
        Insert: {
          committed_draft_id?: string | null
          course?: string
          day_of_week: number
          id?: string
          meal_plan_id: string
          option_number?: number
          recipe_id?: string | null
          status?: string
        }
        Update: {
          committed_draft_id?: string | null
          course?: string
          day_of_week?: number
          id?: string
          meal_plan_id?: string
          option_number?: number
          recipe_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_slots_committed_draft_id_fkey"
            columns: ["committed_draft_id"]
            isOneToOne: false
            referencedRelation: "dinner_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_slots_meal_plan_id_fkey"
            columns: ["meal_plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_plan_slots_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plans: {
        Row: {
          created_at: string
          family_id: string
          id: string
          week_start_date: string
        }
        Insert: {
          created_at?: string
          family_id: string
          id?: string
          week_start_date: string
        }
        Update: {
          created_at?: string
          family_id?: string
          id?: string
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plans_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      prescribed_plans: {
        Row: {
          created_at: string
          created_by: string | null
          daily_calories: number | null
          diet_type: string | null
          duration_weeks: number | null
          family_id: string
          id: string
          member_id: string
          parsed_data: Json | null
          plan_name: string
          raw_file_url: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          daily_calories?: number | null
          diet_type?: string | null
          duration_weeks?: number | null
          family_id: string
          id?: string
          member_id: string
          parsed_data?: Json | null
          plan_name: string
          raw_file_url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          daily_calories?: number | null
          diet_type?: string | null
          duration_weeks?: number | null
          family_id?: string
          id?: string
          member_id?: string
          parsed_data?: Json | null
          plan_name?: string
          raw_file_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prescribed_plans_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescribed_plans_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_ingredients: {
        Row: {
          id: string
          name: string
          quantity: number | null
          recipe_id: string
          unit: string | null
        }
        Insert: {
          id?: string
          name: string
          quantity?: number | null
          recipe_id: string
          unit?: string | null
        }
        Update: {
          id?: string
          name?: string
          quantity?: number | null
          recipe_id?: string
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      family_recipes: {
        Row: {
          added_at: string
          added_by: string | null
          family_id: string
          id: string
          is_favourite: boolean
          recipe_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          family_id: string
          id?: string
          is_favourite?: boolean
          recipe_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          family_id?: string
          id?: string
          is_favourite?: boolean
          recipe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_recipes_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_recipes_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          calories_per_serving: number | null
          carbs_g: number | null
          cook_time: number | null
          course: string | null
          created_at: string
          created_by: string | null
          cuisine: string | null
          description: string | null
          diet_types: string[]
          external_id: string | null
          family_id: string | null
          fat_g: number | null
          id: string
          image_url: string | null
          instructions: string | null
          is_favourite: boolean
          is_global: boolean
          prep_time: number | null
          protein_g: number | null
          servings: number | null
          source: string
          source_attribution: string | null
          source_url: string | null
          spoonacular_id: number | null
          themealdb_id: string | null
          image_attribution: string | null
          nutrition_estimated: boolean
          title: string
        }
        Insert: {
          calories_per_serving?: number | null
          carbs_g?: number | null
          cook_time?: number | null
          course?: string | null
          created_at?: string
          created_by?: string | null
          cuisine?: string | null
          description?: string | null
          diet_types?: string[]
          external_id?: string | null
          family_id?: string | null
          fat_g?: number | null
          id?: string
          image_url?: string | null
          instructions?: string | null
          is_favourite?: boolean
          is_global?: boolean
          prep_time?: number | null
          protein_g?: number | null
          servings?: number | null
          source?: string
          source_attribution?: string | null
          source_url?: string | null
          spoonacular_id?: number | null
          themealdb_id?: string | null
          image_attribution?: string | null
          nutrition_estimated?: boolean
          title: string
        }
        Update: {
          calories_per_serving?: number | null
          carbs_g?: number | null
          cook_time?: number | null
          course?: string | null
          created_at?: string
          created_by?: string | null
          cuisine?: string | null
          description?: string | null
          diet_types?: string[]
          external_id?: string | null
          family_id?: string | null
          fat_g?: number | null
          id?: string
          image_url?: string | null
          instructions?: string | null
          is_favourite?: boolean
          is_global?: boolean
          prep_time?: number | null
          protein_g?: number | null
          servings?: number | null
          source?: string
          source_attribution?: string | null
          source_url?: string | null
          spoonacular_id?: number | null
          themealdb_id?: string | null
          image_attribution?: string | null
          nutrition_estimated?: boolean
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_list_items: {
        Row: {
          checked: boolean
          id: string
          ingredient_name: string
          list_id: string
          quantity: number | null
          store: string | null
          unit: string | null
        }
        Insert: {
          checked?: boolean
          id?: string
          ingredient_name: string
          list_id: string
          quantity?: number | null
          store?: string | null
          unit?: string | null
        }
        Update: {
          checked?: boolean
          id?: string
          ingredient_name?: string
          list_id?: string
          quantity?: number | null
          store?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shopping_list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "shopping_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_lists: {
        Row: {
          generated_at: string
          id: string
          meal_plan_id: string
        }
        Insert: {
          generated_at?: string
          id?: string
          meal_plan_id: string
        }
        Update: {
          generated_at?: string
          id?: string
          meal_plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_lists_meal_plan_id_fkey"
            columns: ["meal_plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      votes: {
        Row: {
          created_at: string
          id: string
          meal_plan_slot_id: string
          member_id: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          meal_plan_slot_id: string
          member_id: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          meal_plan_slot_id?: string
          member_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_meal_plan_slot_id_fkey"
            columns: ["meal_plan_slot_id"]
            isOneToOne: false
            referencedRelation: "meal_plan_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      active_family_id: { Args: Record<string, never>; Returns: string | null }
      join_family: { Args: { code: string; display_name: string }; Returns: string }
      finalise_dinner_draft: { Args: { draft_id: string; expected_winner: string }; Returns: Json }
      cancel_dinner_draft: { Args: { draft_id: string }; Returns: undefined }
      replace_shopping_list: { Args: { plan_id: string; items: Json }; Returns: string }

      get_family_by_invite_code: {
        Args: { code: string }
        Returns: {
          id: string
          name: string
        }[]
      }
      is_family_admin: { Args: { check_family_id: string }; Returns: boolean }
      is_family_member: { Args: { check_family_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
