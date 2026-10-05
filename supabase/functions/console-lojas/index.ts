// Edge Function `console-lojas`: a equipe da plataforma cria uma loja para um dono, pelo e-mail.
//   { acao: "criar", marca, nome, slug, email }
// Se o e-mail ainda não tem conta, a conta é criada (o dono entra em /pdv com o código que chega no e-mail).
// O banco confere de novo se quem chamou é administrador da plataforma.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
};
const resposta = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return resposta(405, { erro: 'Use POST' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const usuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });

  const { data: souAdmin } = await usuario.rpc('sou_admin_da_plataforma');
  if (souAdmin !== true) return resposta(403, { erro: 'Só a equipe da plataforma cria lojas.' });

  let corpo: Record<string, unknown>;
  try {
    corpo = await req.json();
  } catch {
    return resposta(400, { erro: 'Pedido inválido.' });
  }
  if (corpo.acao !== 'criar') return resposta(400, { erro: 'Ação desconhecida.' });

  const email = String(corpo.email ?? '')
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return resposta(400, { erro: 'Confira o e-mail do dono.' });
  if (email.endsWith('@equipe.usefood.app'))
    return resposta(400, { erro: 'Use o e-mail de verdade do dono.' });

  // Dono já tem conta? Se não, cria (sem senha: ele entra com o código do e-mail)
  let { data: dono } = await admin.rpc('console_usuario_por_email', { p_email: email });
  let contaNova = false;
  if (!dono) {
    const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
    if (error || !data.user)
      return resposta(400, { erro: 'Não foi possível criar a conta do dono.' });
    dono = data.user.id;
    contaNova = true;
  }

  const { data: loja, error } = await usuario.rpc('console_criar_loja', {
    p_marca: String(corpo.marca ?? ''),
    p_nome: String(corpo.nome ?? ''),
    p_slug: String(corpo.slug ?? ''),
    p_dono: dono,
  });
  if (error) {
    // Não deixa conta solta se a loja não foi criada
    if (contaNova) await admin.auth.admin.deleteUser(dono as string);
    return resposta(400, { erro: error.message });
  }
  return resposta(200, { loja, conta_nova: contaNova });
});
