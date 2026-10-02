// GERADO a partir do banco de homologação (supabase gen types / MCP). Não edite à mão:
// com o Supabase local rodando, use `pnpm db:types`.
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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      brand_members: {
        Row: {
          brand_id: string
          created_at: string
          role: Database["public"]["Enums"]["brand_role"]
          user_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          role: Database["public"]["Enums"]["brand_role"]
          user_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          role?: Database["public"]["Enums"]["brand_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_members_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          created_at: string
          id: string
          is_franchise: boolean
          name: string
          slug: string
          status: Database["public"]["Enums"]["brand_status"]
          theme: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_franchise?: boolean
          name: string
          slug: string
          status?: Database["public"]["Enums"]["brand_status"]
          theme?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_franchise?: boolean
          name?: string
          slug?: string
          status?: Database["public"]["Enums"]["brand_status"]
          theme?: Json
          updated_at?: string
        }
        Relationships: []
      }
      domains: {
        Row: {
          brand_id: string
          created_at: string
          hostname: string
          id: string
          is_primary: boolean
          kind: Database["public"]["Enums"]["domain_kind"]
          last_error: string | null
          provider: string
          restaurant_id: string | null
          status: Database["public"]["Enums"]["domain_status"]
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          brand_id: string
          created_at?: string
          hostname: string
          id?: string
          is_primary?: boolean
          kind?: Database["public"]["Enums"]["domain_kind"]
          last_error?: string | null
          provider?: string
          restaurant_id?: string | null
          status?: Database["public"]["Enums"]["domain_status"]
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          brand_id?: string
          created_at?: string
          hostname?: string
          id?: string
          is_primary?: boolean
          kind?: Database["public"]["Enums"]["domain_kind"]
          last_error?: string | null
          provider?: string
          restaurant_id?: string | null
          status?: Database["public"]["Enums"]["domain_status"]
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_domains_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "domains_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          restaurant_id: string
          role: Database["public"]["Enums"]["restaurant_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          restaurant_id: string
          role: Database["public"]["Enums"]["restaurant_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          restaurant_id?: string
          role?: Database["public"]["Enums"]["restaurant_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          brand_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reserved_slugs: {
        Row: {
          slug: string
        }
        Insert: {
          slug: string
        }
        Update: {
          slug?: string
        }
        Relationships: []
      }
      restaurants: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          location: unknown
          name: string
          organization_id: string
          slug: string
          status: Database["public"]["Enums"]["restaurant_status"]
          timezone: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          location?: unknown
          name: string
          organization_id: string
          slug: string
          status?: Database["public"]["Enums"]["restaurant_status"]
          timezone?: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          location?: unknown
          name?: string
          organization_id?: string
          slug?: string
          status?: Database["public"]["Enums"]["restaurant_status"]
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurants_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurants_organization_id_brand_id_fkey"
            columns: ["organization_id", "brand_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id", "brand_id"]
          },
        ]
      }
      territories: {
        Row: {
          area: unknown
          brand_id: string
          created_at: string
          ibge_code: string | null
          id: string
          is_exclusive: boolean
          name: string
          updated_at: string
        }
        Insert: {
          area?: unknown
          brand_id: string
          created_at?: string
          ibge_code?: string | null
          id?: string
          is_exclusive?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          area?: unknown
          brand_id?: string
          created_at?: string
          ibge_code?: string | null
          id?: string
          is_exclusive?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "territories_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      criar_restaurante: {
        Args: { p_marca: string; p_nome: string; p_slug: string }
        Returns: string
      }
      resolver_dominio: {
        Args: { p_hostname: string }
        Returns: {
          brand_slug: string
          kind: Database["public"]["Enums"]["domain_kind"]
          restaurant_slug: string
        }[]
      }
    }
    Enums: {
      brand_role: "franqueado" | "suporte"
      brand_status: "rascunho" | "ativa" | "suspensa"
      domain_kind: "marca" | "loja"
      domain_status: "pendente" | "verificando" | "ativo" | "erro"
      restaurant_role: "dono" | "gerente" | "caixa" | "garcom" | "cozinha"
      restaurant_status: "rascunho" | "ativo" | "pausado" | "encerrado"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never
