import type { AppSupabaseClient, Tables } from '@usefood/db';

export type LojaPublica = Pick<
  Tables<'restaurants'>,
  | 'id'
  | 'name'
  | 'slug'
  | 'description'
  | 'phone'
  | 'logo_path'
  | 'cover_path'
  | 'street'
  | 'street_number'
  | 'district'
  | 'city'
  | 'accepts_delivery'
  | 'accepts_pickup'
  | 'delivery_fee_mode'
  | 'min_order_cents'
  | 'free_delivery_above_cents'
  | 'prep_minutes_min'
  | 'prep_minutes_max'
>;
export type Horario = Pick<Tables<'opening_hours'>, 'weekday' | 'opens' | 'closes'>;

const CAMPOS =
  'id, name, slug, description, phone, logo_path, cover_path, street, street_number, district, city, accepts_delivery, accepts_pickup, delivery_fee_mode, min_order_cents, free_delivery_above_cents, prep_minutes_min, prep_minutes_max';

/** Loja no ar da marca do site, pelo endereço. Loja em cadastro ou pausada não aparece. */
export async function buscarLoja(
  supabase: AppSupabaseClient,
  marca: string,
  slug: string,
): Promise<{ loja: LojaPublica; horarios: Horario[]; aberta: boolean } | null> {
  const { data: m } = await supabase.from('brands').select('id').eq('slug', marca).maybeSingle();
  if (!m) return null;
  const { data: loja, error } = await supabase
    .from('restaurants')
    .select(CAMPOS)
    .eq('brand_id', m.id)
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!loja) return null;
  const [h, a] = await Promise.all([
    supabase
      .from('opening_hours')
      .select('weekday, opens, closes')
      .eq('restaurant_id', loja.id)
      .order('opens'),
    supabase.rpc('loja_aberta_agora', { p_restaurant_id: loja.id }),
  ]);
  return { loja, horarios: h.data ?? [], aberta: a.data === true };
}

export const whatsapp = (telefone: string, texto?: string) =>
  `https://wa.me/55${telefone}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`;
