export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      families: {
        Row: {
          id: string;
          name: string;
          invite_code: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          invite_code?: string;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          invite_code?: string;
          created_by?: string;
          created_at?: string;
        };
      };
      family_members: {
        Row: {
          id: string;
          family_id: string;
          user_id: string;
          name: string | null;
          avatar_url: string | null;
          dietary_restrictions: string[];
          role: "admin" | "member";
          joined_at: string;
        };
        Insert: {
          id?: string;
          family_id: string;
          user_id: string;
          name?: string | null;
          avatar_url?: string | null;
          dietary_restrictions?: string[];
          role?: "admin" | "member";
          joined_at?: string;
        };
        Update: {
          id?: string;
          family_id?: string;
          user_id?: string;
          name?: string | null;
          avatar_url?: string | null;
          dietary_restrictions?: string[];
          role?: "admin" | "member";
          joined_at?: string;
        };
      };
      recipes: {
        Row: {
          id: string;
          family_id: string | null;
          title: string;
          source: "ai" | "spoonacular" | "manual";
          instructions: string | null;
          image_url: string | null;
          prep_time: number | null;
          cuisine: string | null;
          is_favourite: boolean;
          spoonacular_id: number | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          family_id?: string | null;
          title: string;
          source?: "ai" | "spoonacular" | "manual";
          instructions?: string | null;
          image_url?: string | null;
          prep_time?: number | null;
          cuisine?: string | null;
          is_favourite?: boolean;
          spoonacular_id?: number | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          family_id?: string | null;
          title?: string;
          source?: "ai" | "spoonacular" | "manual";
          instructions?: string | null;
          image_url?: string | null;
          prep_time?: number | null;
          cuisine?: string | null;
          is_favourite?: boolean;
          spoonacular_id?: number | null;
          created_by?: string | null;
          created_at?: string;
        };
      };
      recipe_ingredients: {
        Row: {
          id: string;
          recipe_id: string;
          name: string;
          quantity: number | null;
          unit: string | null;
        };
        Insert: {
          id?: string;
          recipe_id: string;
          name: string;
          quantity?: number | null;
          unit?: string | null;
        };
        Update: {
          id?: string;
          recipe_id?: string;
          name?: string;
          quantity?: number | null;
          unit?: string | null;
        };
      };
      meal_plans: {
        Row: {
          id: string;
          family_id: string;
          week_start_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          family_id: string;
          week_start_date: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          family_id?: string;
          week_start_date?: string;
          created_at?: string;
        };
      };
      meal_plan_slots: {
        Row: {
          id: string;
          meal_plan_id: string;
          day_of_week: number;
          recipe_id: string | null;
          status: "suggested" | "voted" | "confirmed";
        };
        Insert: {
          id?: string;
          meal_plan_id: string;
          day_of_week: number;
          recipe_id?: string | null;
          status?: "suggested" | "voted" | "confirmed";
        };
        Update: {
          id?: string;
          meal_plan_id?: string;
          day_of_week?: number;
          recipe_id?: string | null;
          status?: "suggested" | "voted" | "confirmed";
        };
      };
      votes: {
        Row: {
          id: string;
          meal_plan_slot_id: string;
          member_id: string;
          value: "up" | "down" | "love";
          created_at: string;
        };
        Insert: {
          id?: string;
          meal_plan_slot_id: string;
          member_id: string;
          value: "up" | "down" | "love";
          created_at?: string;
        };
        Update: {
          id?: string;
          meal_plan_slot_id?: string;
          member_id?: string;
          value?: "up" | "down" | "love";
          created_at?: string;
        };
      };
      shopping_lists: {
        Row: {
          id: string;
          meal_plan_id: string;
          generated_at: string;
        };
        Insert: {
          id?: string;
          meal_plan_id: string;
          generated_at?: string;
        };
        Update: {
          id?: string;
          meal_plan_id?: string;
          generated_at?: string;
        };
      };
      shopping_list_items: {
        Row: {
          id: string;
          list_id: string;
          ingredient_name: string;
          quantity: number | null;
          unit: string | null;
          checked: boolean;
        };
        Insert: {
          id?: string;
          list_id: string;
          ingredient_name: string;
          quantity?: number | null;
          unit?: string | null;
          checked?: boolean;
        };
        Update: {
          id?: string;
          list_id?: string;
          ingredient_name?: string;
          quantity?: number | null;
          unit?: string | null;
          checked?: boolean;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      recipe_source: "ai" | "spoonacular" | "manual";
      slot_status: "suggested" | "voted" | "confirmed";
      vote_value: "up" | "down" | "love";
      member_role: "admin" | "member";
    };
  };
}
