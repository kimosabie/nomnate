export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      families: {
        Row: {
          id: string;
          name: string;
          created_at: string;
          created_by: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
          created_by: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
          created_by?: string;
        };
      };
      family_members: {
        Row: {
          id: string;
          family_id: string;
          user_id: string;
          role: "admin" | "member";
          joined_at: string;
        };
        Insert: {
          id?: string;
          family_id: string;
          user_id: string;
          role?: "admin" | "member";
          joined_at?: string;
        };
        Update: {
          id?: string;
          family_id?: string;
          user_id?: string;
          role?: "admin" | "member";
          joined_at?: string;
        };
      };
      restaurants: {
        Row: {
          id: string;
          name: string;
          cuisine: string | null;
          address: string | null;
          google_place_id: string | null;
          family_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          cuisine?: string | null;
          address?: string | null;
          google_place_id?: string | null;
          family_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          cuisine?: string | null;
          address?: string | null;
          google_place_id?: string | null;
          family_id?: string;
          created_at?: string;
        };
      };
      sessions: {
        Row: {
          id: string;
          family_id: string;
          status: "open" | "voting" | "decided" | "closed";
          winner_restaurant_id: string | null;
          created_by: string;
          created_at: string;
          decided_at: string | null;
        };
        Insert: {
          id?: string;
          family_id: string;
          status?: "open" | "voting" | "decided" | "closed";
          winner_restaurant_id?: string | null;
          created_by: string;
          created_at?: string;
          decided_at?: string | null;
        };
        Update: {
          id?: string;
          family_id?: string;
          status?: "open" | "voting" | "decided" | "closed";
          winner_restaurant_id?: string | null;
          created_by?: string;
          created_at?: string;
          decided_at?: string | null;
        };
      };
      votes: {
        Row: {
          id: string;
          session_id: string;
          user_id: string;
          restaurant_id: string;
          value: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          user_id: string;
          restaurant_id: string;
          value: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          user_id?: string;
          restaurant_id?: string;
          value?: number;
          created_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      session_status: "open" | "voting" | "decided" | "closed";
      member_role: "admin" | "member";
    };
  };
}
