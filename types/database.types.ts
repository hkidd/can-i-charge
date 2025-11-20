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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      charging_stations: {
        Row: {
          address: string | null
          charger_type: string | null
          charger_type_detailed: string | null
          created_at: string
          ev_connector_types: string[] | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string | null
          network: string | null
          num_ports: number | null
          state: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          charger_type?: string | null
          charger_type_detailed?: string | null
          created_at: string
          ev_connector_types?: string[] | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string | null
          network?: string | null
          num_ports?: number | null
          state?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          charger_type?: string | null
          charger_type_detailed?: string | null
          created_at?: string
          ev_connector_types?: string[] | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string | null
          network?: string | null
          num_ports?: number | null
          state?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      county_level_data: {
        Row: {
          center_lat: number
          center_lng: number
          charger_count: number | null
          county_name: string
          daily_vmt: number | null
          ev_infrastructure_score: number | null
          id: string
          need_score: number | null
          population: number | null
          state: string
          traffic_score: number | null
          updated_at: string | null
          vmt_per_capita: number | null
          zoom_range: string | null
        }
        Insert: {
          center_lat: number
          center_lng: number
          charger_count?: number | null
          county_name: string
          daily_vmt?: number | null
          ev_infrastructure_score?: number | null
          id?: string
          need_score?: number | null
          population?: number | null
          state: string
          traffic_score?: number | null
          updated_at?: string | null
          vmt_per_capita?: number | null
          zoom_range?: string | null
        }
        Update: {
          center_lat?: number
          center_lng?: number
          charger_count?: number | null
          county_name?: string
          daily_vmt?: number | null
          ev_infrastructure_score?: number | null
          id?: string
          need_score?: number | null
          population?: number | null
          state?: string
          traffic_score?: number | null
          updated_at?: string | null
          vmt_per_capita?: number | null
          zoom_range?: string | null
        }
        Relationships: []
      }
      neighborhood_level_data: {
        Row: {
          area_id: string
          center_lat: number
          center_lng: number
          charger_count: number | null
          chargers_within_10mi: number | null
          chargers_within_1mi: number | null
          chargers_within_5mi: number | null
          ev_infrastructure_score: number | null
          fast_charger_ratio: number | null
          highway_proximity_score: number | null
          id: string
          name: string | null
          need_score: number | null
          population: number | null
          updated_at: string | null
          zoom_range: string | null
        }
        Insert: {
          area_id: string
          center_lat: number
          center_lng: number
          charger_count?: number | null
          chargers_within_10mi?: number | null
          chargers_within_1mi?: number | null
          chargers_within_5mi?: number | null
          ev_infrastructure_score?: number | null
          fast_charger_ratio?: number | null
          highway_proximity_score?: number | null
          id?: string
          name?: string | null
          need_score?: number | null
          population?: number | null
          updated_at?: string | null
          zoom_range?: string | null
        }
        Update: {
          area_id?: string
          center_lat?: number
          center_lng?: number
          charger_count?: number | null
          chargers_within_10mi?: number | null
          chargers_within_1mi?: number | null
          chargers_within_5mi?: number | null
          ev_infrastructure_score?: number | null
          fast_charger_ratio?: number | null
          highway_proximity_score?: number | null
          id?: string
          name?: string | null
          need_score?: number | null
          population?: number | null
          updated_at?: string | null
          zoom_range?: string | null
        }
        Relationships: []
      }
      state_level_data: {
        Row: {
          center_lat: number
          center_lng: number
          charger_count: number | null
          ev_infrastructure_score: number | null
          id: string
          need_score: number | null
          population: number | null
          state_name: string
          updated_at: string | null
          zoom_range: string | null
        }
        Insert: {
          center_lat: number
          center_lng: number
          charger_count?: number | null
          ev_infrastructure_score?: number | null
          id?: string
          need_score?: number | null
          population?: number | null
          state_name: string
          updated_at?: string | null
          zoom_range?: string | null
        }
        Update: {
          center_lat?: number
          center_lng?: number
          charger_count?: number | null
          ev_infrastructure_score?: number | null
          id?: string
          need_score?: number | null
          population?: number | null
          state_name?: string
          updated_at?: string | null
          zoom_range?: string | null
        }
        Relationships: []
      }
      zip_level_data: {
        Row: {
          avg_distance_to_charger: number | null
          center_lat: number
          center_lng: number
          charger_count: number | null
          county: string | null
          ev_infrastructure_score: number | null
          fast_charger_count: number | null
          id: string
          need_score: number | null
          population: number | null
          state: string
          updated_at: string | null
          zip_code: string
          zoom_range: string | null
        }
        Insert: {
          avg_distance_to_charger?: number | null
          center_lat: number
          center_lng: number
          charger_count?: number | null
          county?: string | null
          ev_infrastructure_score?: number | null
          fast_charger_count?: number | null
          id?: string
          need_score?: number | null
          population?: number | null
          state: string
          updated_at?: string | null
          zip_code: string
          zoom_range?: string | null
        }
        Update: {
          avg_distance_to_charger?: number | null
          center_lat?: number
          center_lng?: number
          charger_count?: number | null
          county?: string | null
          ev_infrastructure_score?: number | null
          fast_charger_count?: number | null
          id?: string
          need_score?: number | null
          population?: number | null
          state?: string
          updated_at?: string | null
          zip_code?: string
          zoom_range?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
