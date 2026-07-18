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
      cards: {
        Row: {
          active: boolean
          color: string
          created_at: string
          first4: string
          id: string
          last4: string
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          active?: boolean
          color?: string
          created_at?: string
          first4: string
          id?: string
          last4: string
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          active?: boolean
          color?: string
          created_at?: string
          first4?: string
          id?: string
          last4?: string
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cards_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_products: {
        Row: {
          brazil_price: number | null
          brazil_pv: number | null
          business_price: number | null
          consumer_price: number | null
          created_at: string
          handling_fee: number | null
          id: string
          is_official_name: boolean
          is_set: boolean
          is_visible: boolean
          korea_price: number | null
          korea_pv: number | null
          memo: string | null
          name_ko: string
          name_pt: string | null
          pack_quantity: number | null
          product_code: string | null
          updated_at: string
          weight: number | null
        }
        Insert: {
          brazil_price?: number | null
          brazil_pv?: number | null
          business_price?: number | null
          consumer_price?: number | null
          created_at?: string
          handling_fee?: number | null
          id?: string
          is_official_name?: boolean
          is_set?: boolean
          is_visible?: boolean
          korea_price?: number | null
          korea_pv?: number | null
          memo?: string | null
          name_ko: string
          name_pt?: string | null
          pack_quantity?: number | null
          product_code?: string | null
          updated_at?: string
          weight?: number | null
        }
        Update: {
          brazil_price?: number | null
          brazil_pv?: number | null
          business_price?: number | null
          consumer_price?: number | null
          created_at?: string
          handling_fee?: number | null
          id?: string
          is_official_name?: boolean
          is_set?: boolean
          is_visible?: boolean
          korea_price?: number | null
          korea_pv?: number | null
          memo?: string | null
          name_ko?: string
          name_pt?: string | null
          pack_quantity?: number | null
          product_code?: string | null
          updated_at?: string
          weight?: number | null
        }
        Relationships: []
      }
      members: {
        Row: {
          affiliation_id: string | null
          birth_date: string | null
          country_code: string | null
          cpf: string | null
          created_at: string
          direct_parent_id: string | null
          direct_parent_side: string | null
          id: string
          is_anchor_member: boolean
          is_favorite: boolean
          is_hidden: boolean
          member_number: string | null
          member_status: string
          name: string | null
          nickname: string | null
          notes: string | null
          phone: string | null
          side: string | null
          sponsor_name_raw: string | null
          updated_at: string
        }
        Insert: {
          affiliation_id?: string | null
          birth_date?: string | null
          country_code?: string | null
          cpf?: string | null
          created_at?: string
          direct_parent_id?: string | null
          direct_parent_side?: string | null
          id?: string
          is_anchor_member?: boolean
          is_favorite?: boolean
          is_hidden?: boolean
          member_number?: string | null
          member_status?: string
          name?: string | null
          nickname?: string | null
          notes?: string | null
          phone?: string | null
          side?: string | null
          sponsor_name_raw?: string | null
          updated_at?: string
        }
        Update: {
          affiliation_id?: string | null
          birth_date?: string | null
          country_code?: string | null
          cpf?: string | null
          created_at?: string
          direct_parent_id?: string | null
          direct_parent_side?: string | null
          id?: string
          is_anchor_member?: boolean
          is_favorite?: boolean
          is_hidden?: boolean
          member_number?: string | null
          member_status?: string
          name?: string | null
          nickname?: string | null
          notes?: string | null
          phone?: string | null
          side?: string | null
          sponsor_name_raw?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "members_affiliation_fk"
            columns: ["affiliation_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_direct_parent_fk"
            columns: ["direct_parent_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      prepayments: {
        Row: {
          approval_amount: number
          approval_date: string
          approval_number: string
          card_color_snapshot: string
          card_first4_snapshot: string
          card_id: string | null
          card_last4_snapshot: string
          card_name_snapshot: string
          card_type: string
          created_at: string
          created_by: string
          id: string
          last_activity_at: string
          memo: string | null
          status: string
          unregistered_card_memo: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          approval_amount: number
          approval_date: string
          approval_number: string
          card_color_snapshot?: string
          card_first4_snapshot: string
          card_id?: string | null
          card_last4_snapshot: string
          card_name_snapshot: string
          card_type: string
          created_at?: string
          created_by: string
          id?: string
          last_activity_at?: string
          memo?: string | null
          status?: string
          unregistered_card_memo?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          approval_amount?: number
          approval_date?: string
          approval_number?: string
          card_color_snapshot?: string
          card_first4_snapshot?: string
          card_id?: string | null
          card_last4_snapshot?: string
          card_name_snapshot?: string
          card_type?: string
          created_at?: string
          created_by?: string
          id?: string
          last_activity_at?: string
          memo?: string | null
          status?: string
          unregistered_card_memo?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prepayments_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prepayments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          id: string
          prepayment_id: string
          status: string
          transaction_date: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          id?: string
          prepayment_id: string
          status?: string
          transaction_date: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          id?: string
          prepayment_id?: string
          status?: string
          transaction_date?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_prepayment_id_fkey"
            columns: ["prepayment_id"]
            isOneToOne: false
            referencedRelation: "prepayments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          role: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      catalog_public_products: {
        Row: {
          brazil_price: number | null
          business_price: number | null
          consumer_price: number | null
          id: string | null
          is_set: boolean | null
          name_ko: string | null
          name_pt: string | null
          pack_quantity: number | null
        }
        Insert: {
          brazil_price?: number | null
          business_price?: number | null
          consumer_price?: number | null
          id?: string | null
          is_set?: boolean | null
          name_ko?: string | null
          name_pt?: string | null
          pack_quantity?: number | null
        }
        Update: {
          brazil_price?: number | null
          business_price?: number | null
          consumer_price?: number | null
          id?: string | null
          is_set?: boolean | null
          name_ko?: string | null
          name_pt?: string | null
          pack_quantity?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_ngmembers_access: {
        Args: never
        Returns: {
          is_authorized: boolean
          role: string
        }[]
      }
      has_ngmembers_admin_access: { Args: never; Returns: boolean }
      is_catalog_admin: { Args: never; Returns: boolean }
      paynowbiz_archive_prepayments: {
        Args: {
          archive_year: number
          page_limit?: number
          page_offset?: number
          recent_since: string
          target_workspace_id: string
        }
        Returns: {
          active_used: number
          approval_amount: number
          approval_date: string
          approval_number: string
          card_color_snapshot: string
          card_first4_snapshot: string
          card_id: string
          card_last4_snapshot: string
          card_name_snapshot: string
          card_type: string
          created_at: string
          created_by: string
          id: string
          last_activity_at: string
          memo: string
          remaining_amount: number
          status: string
          unregistered_card_memo: string
          updated_at: string
          workspace_id: string
        }[]
      }
      paynowbiz_archive_years: {
        Args: { recent_since: string; target_workspace_id: string }
        Returns: {
          approval_year: number
          record_count: number
        }[]
      }
      paynowbiz_search_prepayments: {
        Args: {
          approval_query: string
          page_limit?: number
          target_workspace_id: string
        }
        Returns: {
          active_used: number
          approval_amount: number
          approval_date: string
          approval_number: string
          card_color_snapshot: string
          card_first4_snapshot: string
          card_id: string
          card_last4_snapshot: string
          card_name_snapshot: string
          card_type: string
          created_at: string
          created_by: string
          id: string
          last_activity_at: string
          memo: string
          remaining_amount: number
          status: string
          unregistered_card_memo: string
          updated_at: string
          workspace_id: string
        }[]
      }
      paynowbiz_visible_prepayments: {
        Args: { recent_since: string; target_workspace_id: string }
        Returns: {
          active_used: number
          approval_amount: number
          approval_date: string
          approval_number: string
          card_color_snapshot: string
          card_first4_snapshot: string
          card_id: string
          card_last4_snapshot: string
          card_name_snapshot: string
          card_type: string
          created_at: string
          created_by: string
          id: string
          last_activity_at: string
          memo: string
          remaining_amount: number
          status: string
          unregistered_card_memo: string
          updated_at: string
          workspace_id: string
        }[]
      }
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
