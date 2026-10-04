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
      cash_movements: {
        Row: {
          amount_cents: number
          created_at: string
          created_by: string | null
          id: string
          reason: string | null
          restaurant_id: string
          session_id: string
          type: Database["public"]["Enums"]["cash_movement_type"]
        }
        Insert: {
          amount_cents: number
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string | null
          restaurant_id: string
          session_id: string
          type: Database["public"]["Enums"]["cash_movement_type"]
        }
        Update: {
          amount_cents?: number
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string | null
          restaurant_id?: string
          session_id?: string
          type?: Database["public"]["Enums"]["cash_movement_type"]
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_session_id_restaurant_id_fkey"
            columns: ["session_id", "restaurant_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id", "restaurant_id"]
          },
        ]
      }
      cash_sessions: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          closing_notes: string | null
          counted_cents: number | null
          difference_cents: number | null
          expected_cents: number | null
          id: string
          opened_at: string
          opened_by: string | null
          opening_cents: number
          register_name: string
          restaurant_id: string
          status: Database["public"]["Enums"]["cash_session_status"]
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          closing_notes?: string | null
          counted_cents?: number | null
          difference_cents?: number | null
          expected_cents?: number | null
          id?: string
          opened_at?: string
          opened_by?: string | null
          opening_cents: number
          register_name?: string
          restaurant_id: string
          status?: Database["public"]["Enums"]["cash_session_status"]
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          closing_notes?: string | null
          counted_cents?: number | null
          difference_cents?: number | null
          expected_cents?: number | null
          id?: string
          opened_at?: string
          opened_by?: string | null
          opening_cents?: number
          register_name?: string
          restaurant_id?: string
          status?: Database["public"]["Enums"]["cash_session_status"]
        }
        Relationships: [
          {
            foreignKeyName: "cash_sessions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
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
      dining_tables: {
        Row: {
          area: string
          created_at: string
          id: string
          is_active: boolean
          label: string
          position: number
          restaurant_id: string
          seats: number | null
        }
        Insert: {
          area?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          position?: number
          restaurant_id: string
          seats?: number | null
        }
        Update: {
          area?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          position?: number
          restaurant_id?: string
          seats?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dining_tables_restaurant_id_fkey"
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
      order_item_modifiers: {
        Row: {
          group_name: string
          id: string
          modifier_id: string | null
          name: string
          order_item_id: string
          price_cents: number
          restaurant_id: string
        }
        Insert: {
          group_name: string
          id?: string
          modifier_id?: string | null
          name: string
          order_item_id: string
          price_cents: number
          restaurant_id: string
        }
        Update: {
          group_name?: string
          id?: string
          modifier_id?: string | null
          name?: string
          order_item_id?: string
          price_cents?: number
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_item_modifiers_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          order_id: string
          prepared_at: string | null
          product_id: string | null
          product_name: string
          quantity: number
          restaurant_id: string
          station_id: string | null
          total_cents: number
          unit_price_cents: number
          variant_id: string | null
          variant_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          order_id: string
          prepared_at?: string | null
          product_id?: string | null
          product_name: string
          quantity: number
          restaurant_id: string
          station_id?: string | null
          total_cents: number
          unit_price_cents: number
          variant_id?: string | null
          variant_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string
          prepared_at?: string | null
          product_id?: string | null
          product_name?: string
          quantity?: number
          restaurant_id?: string
          station_id?: string | null
          total_cents?: number
          unit_price_cents?: number
          variant_id?: string | null
          variant_name?: string | null
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
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          created_by: string | null
          day: string
          delivered_at: string | null
          discount_cents: number
          id: string
          identifier: string
          identifier_type: Database["public"]["Enums"]["identifier_type"]
          notes: string | null
          number: number
          paid_cents: number
          ready_at: string | null
          restaurant_id: string
          service_fee_cents: number
          status: Database["public"]["Enums"]["order_status"]
          subtotal_cents: number
          tab_id: string | null
          total_cents: number
          type: Database["public"]["Enums"]["order_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          day: string
          delivered_at?: string | null
          discount_cents?: number
          id?: string
          identifier: string
          identifier_type?: Database["public"]["Enums"]["identifier_type"]
          notes?: string | null
          number: number
          paid_cents?: number
          ready_at?: string | null
          restaurant_id: string
          service_fee_cents?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_cents?: number
          tab_id?: string | null
          total_cents?: number
          type: Database["public"]["Enums"]["order_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          day?: string
          delivered_at?: string | null
          discount_cents?: number
          id?: string
          identifier?: string
          identifier_type?: Database["public"]["Enums"]["identifier_type"]
          notes?: string | null
          number?: number
          paid_cents?: number
          ready_at?: string | null
          restaurant_id?: string
          service_fee_cents?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_cents?: number
          tab_id?: string | null
          total_cents?: number
          type?: Database["public"]["Enums"]["order_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_tab_fkey"
            columns: ["tab_id", "restaurant_id"]
            isOneToOne: false
            referencedRelation: "tabs"
            referencedColumns: ["id", "restaurant_id"]
          },
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
          cash_session_id: string | null
          change_cents: number
          created_at: string
          created_by: string | null
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          order_id: string | null
          restaurant_id: string
          tab_id: string | null
        }
        Insert: {
          amount_cents: number
          cash_session_id?: string | null
          change_cents?: number
          created_at?: string
          created_by?: string | null
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          order_id?: string | null
          restaurant_id: string
          tab_id?: string | null
        }
        Update: {
          amount_cents?: number
          cash_session_id?: string | null
          change_cents?: number
          created_at?: string
          created_by?: string | null
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          order_id?: string | null
          restaurant_id?: string
          tab_id?: string | null
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
      print_agent_pairings: {
        Row: {
          code_hash: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          restaurant_id: string
          used_at: string | null
        }
        Insert: {
          code_hash: string
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          restaurant_id: string
          used_at?: string | null
        }
        Update: {
          code_hash?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          restaurant_id?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "print_agent_pairings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      print_agents: {
        Row: {
          created_at: string
          id: string
          last_seen_at: string | null
          name: string
          restaurant_id: string
          revoked_at: string | null
          user_id: string
          version: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          last_seen_at?: string | null
          name: string
          restaurant_id: string
          revoked_at?: string | null
          user_id: string
          version?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          last_seen_at?: string | null
          name?: string
          restaurant_id?: string
          revoked_at?: string | null
          user_id?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "print_agents_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      print_jobs: {
        Row: {
          agent_id: string | null
          attempts: number
          claimed_at: string | null
          created_at: string
          error: string | null
          id: string
          kind: string
          order_id: string | null
          payload: Json
          printed_at: string | null
          printer_id: string | null
          restaurant_id: string
          station_id: string | null
          status: Database["public"]["Enums"]["print_job_status"]
        }
        Insert: {
          agent_id?: string | null
          attempts?: number
          claimed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          order_id?: string | null
          payload: Json
          printed_at?: string | null
          printer_id?: string | null
          restaurant_id: string
          station_id?: string | null
          status?: Database["public"]["Enums"]["print_job_status"]
        }
        Update: {
          agent_id?: string | null
          attempts?: number
          claimed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          order_id?: string | null
          payload?: Json
          printed_at?: string | null
          printer_id?: string | null
          restaurant_id?: string
          station_id?: string | null
          status?: Database["public"]["Enums"]["print_job_status"]
        }
        Relationships: [
          {
            foreignKeyName: "print_jobs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "print_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_jobs_order_id_restaurant_id_fkey"
            columns: ["order_id", "restaurant_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id", "restaurant_id"]
          },
          {
            foreignKeyName: "print_jobs_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_jobs_station_id_restaurant_id_fkey"
            columns: ["station_id", "restaurant_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id", "restaurant_id"]
          },
        ]
      }
      printers: {
        Row: {
          codepage: string
          created_at: string
          host: string
          id: string
          is_active: boolean
          name: string
          paper_width: number
          port: number
          restaurant_id: string
          station_id: string
        }
        Insert: {
          codepage?: string
          created_at?: string
          host: string
          id?: string
          is_active?: boolean
          name: string
          paper_width?: number
          port?: number
          restaurant_id: string
          station_id: string
        }
        Update: {
          codepage?: string
          created_at?: string
          host?: string
          id?: string
          is_active?: boolean
          name?: string
          paper_width?: number
          port?: number
          restaurant_id?: string
          station_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "printers_station_id_restaurant_id_fkey"
            columns: ["station_id", "restaurant_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id", "restaurant_id"]
          },
        ]
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
          call_by: Database["public"]["Enums"]["call_mode"]
          counter_dine_in: Database["public"]["Enums"]["counter_service"]
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
          call_by?: Database["public"]["Enums"]["call_mode"]
          counter_dine_in?: Database["public"]["Enums"]["counter_service"]
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
          call_by?: Database["public"]["Enums"]["call_mode"]
          counter_dine_in?: Database["public"]["Enums"]["counter_service"]
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
      tabs: {
        Row: {
          change_for_cents: number | null
          closed_at: string | null
          discount_cents: number
          expected_method: Database["public"]["Enums"]["payment_method"] | null
          id: string
          identifier: string
          identifier_type: Database["public"]["Enums"]["identifier_type"]
          opened_at: string
          opened_by: string | null
          paid_cents: number
          restaurant_id: string
          service_fee_cents: number
          status: Database["public"]["Enums"]["tab_status"]
          subtotal_cents: number
          total_cents: number
          type: Database["public"]["Enums"]["order_type"]
        }
        Insert: {
          change_for_cents?: number | null
          closed_at?: string | null
          discount_cents?: number
          expected_method?: Database["public"]["Enums"]["payment_method"] | null
          id?: string
          identifier: string
          identifier_type: Database["public"]["Enums"]["identifier_type"]
          opened_at?: string
          opened_by?: string | null
          paid_cents?: number
          restaurant_id: string
          service_fee_cents?: number
          status?: Database["public"]["Enums"]["tab_status"]
          subtotal_cents?: number
          total_cents?: number
          type: Database["public"]["Enums"]["order_type"]
        }
        Update: {
          change_for_cents?: number | null
          closed_at?: string | null
          discount_cents?: number
          expected_method?: Database["public"]["Enums"]["payment_method"] | null
          id?: string
          identifier?: string
          identifier_type?: Database["public"]["Enums"]["identifier_type"]
          opened_at?: string
          opened_by?: string | null
          paid_cents?: number
          restaurant_id?: string
          service_fee_cents?: number
          status?: Database["public"]["Enums"]["tab_status"]
          subtotal_cents?: number
          total_cents?: number
          type?: Database["public"]["Enums"]["order_type"]
        }
        Relationships: [
          {
            foreignKeyName: "tabs_restaurant_id_fkey"
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
      abrir_caixa: {
        Args: { p_caixa?: string; p_fundo_cents: number; p_restaurant_id: string }
        Returns: string
      }
      agente_presente: {
        Args: { p_versao?: string | null }
        Returns: string
      }
      concluir_impressao: {
        Args: { p_erro?: string | null; p_job: string; p_ok: boolean }
        Returns: Database["public"]["Enums"]["print_job_status"]
      }
      criar_codigo_de_pareamento: {
        Args: { p_restaurant_id: string }
        Returns: { codigo: string; expira_em: string }[]
      }
      criar_mesas: {
        Args: { p_area?: string; p_ate: number; p_de: number; p_restaurant_id: string }
        Returns: number
      }
      criar_pedido: {
        Args: {
          p_identificador: string | null
          p_identificador_tipo: Database["public"]["Enums"]["identifier_type"]
          p_itens: Json
          p_observacao?: string | null
          p_pagamento_previsto?: Database["public"]["Enums"]["payment_method"] | null
          p_restaurant_id: string
          p_tipo: Database["public"]["Enums"]["order_type"]
          p_troco_para_cents?: number | null
        }
        Returns: {
          conta_id: string
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
      desfazer_pronto: {
        Args: { p_pedido: string; p_praca?: string | null }
        Returns: Database["public"]["Enums"]["order_status"]
      }
      desligar_agente: {
        Args: { p_agente: string }
        Returns: undefined
      }
      fechar_caixa: {
        Args: { p_contado_cents: number; p_observacao?: string | null; p_sessao: string }
        Returns: {
          contado_cents: number
          diferenca_cents: number
          esperado_cents: number
        }[]
      }
      imprimir_teste: {
        Args: { p_impressora: string }
        Returns: string
      }
      marcar_entregue: {
        Args: { p_pedido: string }
        Returns: Database["public"]["Enums"]["order_status"]
      }
      marcar_pronto: {
        Args: { p_pedido: string; p_praca?: string | null }
        Returns: Database["public"]["Enums"]["order_status"]
      }
      movimentar_caixa: {
        Args: {
          p_motivo?: string | null
          p_sessao: string
          p_tipo: Database["public"]["Enums"]["cash_movement_type"]
          p_valor_cents: number
        }
        Returns: string
      }
      pegar_impressao: {
        Args: { p_job: string }
        Returns: {
          codepage: string
          host: string
          kind: string
          paper_width: number
          payload: Json
          port: number
        }[]
      }
      receber_conta: {
        Args: {
          p_conta: string
          p_metodo: Database["public"]["Enums"]["payment_method"]
          p_recebido_cents?: number | null
          p_taxa_servico?: boolean | null
          p_valor_cents: number
        }
        Returns: {
          falta_cents: number
          pago_cents: number
          total_cents: number
          troco_cents: number
        }[]
      }
      reimprimir_pedido: {
        Args: { p_pedido: string }
        Returns: number
      }
      resolver_dominio: {
        Args: { p_hostname: string }
        Returns: {
          brand_slug: string
          kind: Database["public"]["Enums"]["domain_kind"]
          restaurant_slug: string
        }[]
      }
      resumo_do_caixa: {
        Args: { p_sessao: string }
        Returns: {
          credito_cents: number
          debito_cents: number
          dinheiro_cents: number
          esperado_cents: number
          fundo_cents: number
          outros_cents: number
          pedidos: number
          pix_cents: number
          sangrias_cents: number
          suprimentos_cents: number
          vendido_cents: number
        }[]
      }
    }
    Enums: {
      brand_role: "franqueado" | "suporte"
      brand_status: "rascunho" | "ativa" | "suspensa"
      call_mode: "senha" | "nome"
      cash_movement_type: "sangria" | "suprimento"
      cash_session_status: "aberto" | "fechado"
      counter_service: "cliente_busca" | "garcom_leva"
      domain_kind: "marca" | "loja"
      domain_status: "pendente" | "verificando" | "ativo" | "erro"
      identifier_type: "senha" | "nome" | "mesa" | "comanda"
      order_status: "aberto" | "em_preparo" | "pronto" | "concluido" | "cancelado"
      order_type: "balcao" | "mesa" | "retirada" | "delivery"
      payment_method: "dinheiro" | "pix" | "credito" | "debito" | "vale_refeicao" | "outro"
      print_job_status: "pendente" | "imprimindo" | "impresso" | "falhou"
      restaurant_role: "dono" | "gerente" | "caixa" | "garcom" | "cozinha"
      restaurant_status: "rascunho" | "ativo" | "pausado" | "encerrado"
      sales_channel: "salao" | "balcao" | "delivery" | "marketplace"
      tab_status: "aberta" | "fechada" | "cancelada"
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
