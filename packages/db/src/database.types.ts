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
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          position: number
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          position?: number
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          position?: number
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
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
      modifier_groups: {
        Row: {
          created_at: string
          id: string
          max_select: number | null
          min_select: number
          name: string
          position: number
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_select?: number | null
          min_select?: number
          name: string
          position?: number
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          max_select?: number | null
          min_select?: number
          name?: string
          position?: number
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modifier_groups_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      modifiers: {
        Row: {
          created_at: string
          group_id: string
          id: string
          is_active: boolean
          name: string
          position: number
          price_cents: number
          restaurant_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          is_active?: boolean
          name: string
          position?: number
          price_cents?: number
          restaurant_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          is_active?: boolean
          name?: string
          position?: number
          price_cents?: number
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "modifiers_group_id_restaurant_id_fkey"
            columns: ["group_id", "restaurant_id"]
            isOneToOne: false
            referencedRelation: "modifier_groups"
            referencedColumns: ["id", "restaurant_id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          restaurant_id: string
          station_id: string | null
          total_cents: number
          unit_price_cents: number
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          order_id: string
          product_id?: string | null
          product_name: string
          quantity: number
          restaurant_id: string
          station_id?: string | null
          total_cents: number
          unit_price_cents: number
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          restaurant_id?: string
          station_id?: string | null
          total_cents?: number
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_restaurant_id_fkey"
            columns: ["order_id", "restaurant_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id", "restaurant_id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          created_by: string | null
          day: string
          discount_cents: number
          id: string
          identifier: string
          identifier_type: Database["public"]["Enums"]["identifier_type"]
          notes: string | null
          number: number
          paid_cents: number
          restaurant_id: string
          service_fee_cents: number
          status: Database["public"]["Enums"]["order_status"]
          subtotal_cents: number
          total_cents: number
          type: Database["public"]["Enums"]["order_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          day: string
          discount_cents?: number
          id?: string
          identifier: string
          identifier_type?: Database["public"]["Enums"]["identifier_type"]
          notes?: string | null
          number: number
          paid_cents?: number
          restaurant_id: string
          service_fee_cents?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_cents?: number
          total_cents?: number
          type: Database["public"]["Enums"]["order_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          day?: string
          discount_cents?: number
          id?: string
          identifier?: string
          identifier_type?: Database["public"]["Enums"]["identifier_type"]
          notes?: string | null
          number?: number
          paid_cents?: number
          restaurant_id?: string
          service_fee_cents?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_cents?: number
          total_cents?: number
          type?: Database["public"]["Enums"]["order_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_restaurant_id_fkey"
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
      payments: {
        Row: {
          amount_cents: number
          change_cents: number
          created_at: string
          created_by: string | null
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          order_id: string
          restaurant_id: string
        }
        Insert: {
          amount_cents: number
          change_cents?: number
          created_at?: string
          created_by?: string | null
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          order_id: string
          restaurant_id: string
        }
        Update: {
          amount_cents?: number
          change_cents?: number
          created_at?: string
          created_by?: string | null
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          order_id?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_restaurant_id_fkey"
            columns: ["order_id", "restaurant_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id", "restaurant_id"]
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
      product_modifier_groups: {
        Row: {
          group_id: string
          position: number
          product_id: string
          restaurant_id: string
        }
        Insert: {
          group_id: string
          position?: number
          product_id: string
          restaurant_id: string
        }
        Update: {
          group_id?: string
          position?: number
          product_id?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_modifier_groups_group_id_restaurant_id_fkey"
            columns: ["group_id", "restaurant_id"]
            isOneToOne: false
            referencedRelation: "modifier_groups"
            referencedColumns: ["id", "restaurant_id"]
          },
          {
            foreignKeyName: "product_modifier_groups_product_id_restaurant_id_fkey"
            columns: ["product_id", "restaurant_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "restaurant_id"]
          },
        ]
      }
      product_variants: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          position: number
          price_cents: number
          product_id: string
          restaurant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          position?: number
          price_cents: number
          product_id: string
          restaurant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          position?: number
          price_cents?: number
          product_id?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_restaurant_id_fkey"
            columns: ["product_id", "restaurant_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "restaurant_id"]
          },
        ]
      }
      products: {
        Row: {
          available_channels: Database["public"]["Enums"]["sales_channel"][]
          category_id: string
          code: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          photo_path: string | null
          position: number
          price_cents: number
          restaurant_id: string
          station_id: string | null
          updated_at: string
        }
        Insert: {
          available_channels?: Database["public"]["Enums"]["sales_channel"][]
          category_id: string
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          photo_path?: string | null
          position?: number
          price_cents: number
          restaurant_id: string
          station_id?: string | null
          updated_at?: string
        }
        Update: {
          available_channels?: Database["public"]["Enums"]["sales_channel"][]
          category_id?: string
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          photo_path?: string | null
          position?: number
          price_cents?: number
          restaurant_id?: string
          station_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_restaurant_id_fkey"
            columns: ["category_id", "restaurant_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id", "restaurant_id"]
          },
          {
            foreignKeyName: "products_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_station_id_restaurant_id_fkey"
            columns: ["station_id", "restaurant_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id", "restaurant_id"]
          },
        ]
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
      stations: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
          restaurant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number
          restaurant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
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
      ticket_sequences: {
        Row: {
          day: string
          last_number: number
          restaurant_id: string
        }
        Insert: {
          day: string
          last_number: number
          restaurant_id: string
        }
        Update: {
          day?: string
          last_number?: number
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_sequences_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      criar_pedido: {
        Args: {
          p_identificador: string | null
          p_identificador_tipo: Database["public"]["Enums"]["identifier_type"]
          p_itens: Json
          p_observacao?: string | null
          p_restaurant_id: string
          p_taxa_servico?: boolean
          p_tipo: Database["public"]["Enums"]["order_type"]
        }
        Returns: {
          id: string
          identificador: string
          numero: number
          total_cents: number
        }[]
      }
      criar_restaurante: {
        Args: { p_marca: string; p_nome: string; p_slug: string }
        Returns: string
      }
      registrar_pagamento: {
        Args: {
          p_metodo: Database["public"]["Enums"]["payment_method"]
          p_pedido: string
          p_valor_cents: number
        }
        Returns: {
          falta_cents: number
          pago_cents: number
          troco_cents: number
        }[]
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
      identifier_type: "senha" | "nome" | "mesa" | "comanda"
      order_status: "aberto" | "em_preparo" | "pronto" | "concluido" | "cancelado"
      order_type: "balcao" | "mesa" | "retirada" | "delivery"
      payment_method: "dinheiro" | "pix" | "credito" | "debito" | "vale_refeicao" | "outro"
      restaurant_role: "dono" | "gerente" | "caixa" | "garcom" | "cozinha"
      restaurant_status: "rascunho" | "ativo" | "pausado" | "encerrado"
      sales_channel: "salao" | "balcao" | "delivery" | "marketplace"
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
