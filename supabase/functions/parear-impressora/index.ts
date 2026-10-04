// Edge Function `parear-impressora`: troca o código de pareamento gerado no PDV por um
// acesso próprio do computador de impressão. Não exige login (o código é a prova).
//
// POST { codigo: "K7QF-2M9X", nome: "Computador do caixa" }
//   → { email, senha, url, chave, loja }
import { createClient } from 'npm:@supabase/supabase-js@2';

const FORMATO = /^[A-HJ-NP-Z2-9]{8}$/;

const resposta = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'content-type, apikey, x-client-info',
    },
  });

async function sha256(texto: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function senhaAleatoria(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return resposta(204, null);
  if (req.method !== 'POST') return resposta(405, { erro: 'Use POST' });

  let corpo: { codigo?: unknown; nome?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return resposta(400, { erro: 'Envie o código de pareamento.' });
  }
  const codigo = String(corpo.codigo ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (!FORMATO.test(codigo))
    return resposta(400, { erro: 'Código inválido. Ele tem 8 letras e números, como K7QF-2M9X.' });
  const nome =
    String(corpo.nome ?? '')
      .trim()
      .slice(0, 60) || 'Computador da loja';

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Usa o código uma vez só: marca como usado no mesmo comando que confere a validade
  const agora = new Date().toISOString();
  const { data: pareamento } = await admin
    .from('print_agent_pairings')
    .update({ used_at: agora })
    .eq('code_hash', await sha256(codigo))
    .eq('kind', 'impressora')
    .is('used_at', null)
    .gt('expires_at', agora)
    .select('restaurant_id')
    .maybeSingle();
  if (!pareamento)
    return resposta(404, { erro: 'Código não encontrado ou vencido. Gere um novo no PDV.' });

  const email = `agente-${crypto.randomUUID()}@impressoras.usefood.app`;
  const senha = senhaAleatoria();
  const { data: criado, error: erroUsuario } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    app_metadata: { tipo: 'agente_impressao', restaurant_id: pareamento.restaurant_id },
  });
  if (erroUsuario || !criado.user)
    return resposta(500, { erro: 'Não foi possível criar o acesso do computador.' });

  const { error: erroAgente } = await admin
    .from('print_agents')
    .insert({ restaurant_id: pareamento.restaurant_id, user_id: criado.user.id, name: nome });
  if (erroAgente) {
    await admin.auth.admin.deleteUser(criado.user.id);
    return resposta(500, { erro: 'Não foi possível registrar o computador.' });
  }

  const { data: loja } = await admin
    .from('restaurants')
    .select('name')
    .eq('id', pareamento.restaurant_id)
    .single();
  return resposta(200, {
    email,
    senha,
    url,
    chave: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    loja: loja?.name ?? '',
  });
});
