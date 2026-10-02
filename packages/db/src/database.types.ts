// Tipos do banco. Escritos à mão para a primeira migração; a partir de agora
// regenere com `pnpm db:types` (Supabase local rodando) sempre que mudar o schema.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type BrandStatus = 'rascunho' | 'ativa' | 'suspensa';
type RestaurantStatus = 'rascunho' | 'ativo' | 'pausado' | 'encerrado';
type RestaurantRole = 'dono' | 'gerente' | 'caixa' | 'garcom' | 'cozinha';
type BrandRole = 'franqueado' | 'suporte';
type DomainKind = 'marca' | 'loja';
type DomainStatus = 'pendente' | 'verificando' | 'ativo' | 'erro';

export type Database = {
  __InternalSupabase: { PostgrestVersion: '13' };
  public: {
    Tables: {
      platform_admins: {
        Row: { user_id: string; created_at: string };
        Insert: { user_id: string; created_at?: string };
        Update: { user_id?: string; created_at?: string };
        Relationships: [];
      };
      brands: {
        Row: {
          id: string;
          slug: string;
          name: string;
          status: BrandStatus;
          is_franchise: boolean;
          theme: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          status?: BrandStatus;
          is_franchise?: boolean;
          theme?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          status?: BrandStatus;
          is_franchise?: boolean;
          theme?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      domains: {
        Row: {
          id: string;
          brand_id: string;
          kind: DomainKind;
          restaurant_id: string | null;
          hostname: string;
          is_primary: boolean;
          status: DomainStatus;
          provider: string;
          last_error: string | null;
          verified_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          kind?: DomainKind;
          restaurant_id?: string | null;
          hostname: string;
          is_primary?: boolean;
          status?: DomainStatus;
          provider?: string;
          last_error?: string | null;
          verified_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          brand_id?: string;
          kind?: DomainKind;
          restaurant_id?: string | null;
          hostname?: string;
          is_primary?: boolean;
          status?: DomainStatus;
          provider?: string;
          last_error?: string | null;
          verified_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      brand_members: {
        Row: { brand_id: string; user_id: string; role: BrandRole; created_at: string };
        Insert: { brand_id: string; user_id: string; role: BrandRole; created_at?: string };
        Update: { brand_id?: string; user_id?: string; role?: BrandRole; created_at?: string };
        Relationships: [];
      };
      territories: {
        Row: {
          id: string;
          brand_id: string;
          name: string;
          ibge_code: string | null;
          area: unknown;
          is_exclusive: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          name: string;
          ibge_code?: string | null;
          area?: unknown;
          is_exclusive?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          brand_id?: string;
          name?: string;
          ibge_code?: string | null;
          area?: unknown;
          is_exclusive?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      organizations: {
        Row: {
          id: string;
          brand_id: string;
          name: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          name: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          brand_id?: string;
          name?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      restaurants: {
        Row: {
          id: string;
          organization_id: string;
          brand_id: string;
          slug: string;
          name: string;
          status: RestaurantStatus;
          location: unknown;
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          brand_id: string;
          slug: string;
          name: string;
          status?: RestaurantStatus;
          location?: unknown;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          brand_id?: string;
          slug?: string;
          name?: string;
          status?: RestaurantStatus;
          location?: unknown;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      memberships: {
        Row: { restaurant_id: string; user_id: string; role: RestaurantRole; created_at: string };
        Insert: { restaurant_id: string; user_id: string; role: RestaurantRole; created_at?: string };
        Update: { restaurant_id?: string; user_id?: string; role?: RestaurantRole; created_at?: string };
        Relationships: [];
      };
      reserved_slugs: {
        Row: { slug: string };
        Insert: { slug: string };
        Update: { slug?: string };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      criar_restaurante: { Args: { p_marca: string; p_nome: string; p_slug: string }; Returns: string };
      resolver_dominio: {
        Args: { p_hostname: string };
        Returns: { kind: DomainKind; brand_slug: string; restaurant_slug: string | null }[];
      };
    };
    Enums: {
      brand_status: BrandStatus;
      restaurant_status: RestaurantStatus;
      restaurant_role: RestaurantRole;
      brand_role: BrandRole;
      domain_kind: DomainKind;
      domain_status: DomainStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicSchema = Database['public'];

export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row'];
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T];
