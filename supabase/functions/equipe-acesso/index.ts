// Edge Function `equipe-acesso`: usada pelo aparelho da loja, que ainda não tem login.
//   { acao: "parear", codigo, nome }  → conecta o aparelho à loja e devolve o token dele
//   { acao: "entrar", token, pin }    → confere o PIN e devolve um acesso de uso único
// O PIN é conferido no banco (entrar_com_pin), que conta as tentativas e trava o aparelho.
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

async function sha256(texto: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function tokenAleatorio(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return resposta(405, { erro: 'Use POST' });

  let corpo: Record<string, unknown>;
  try {
    corpo = await req.json();
  } catch {
    return resposta(400, { erro: 'Pedido inválido.' });
  }
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  if (corpo.acao === 'parear') {
    const codigo = String(corpo.codigo ?? '');
    if (!/^[A-Za-z2-9]{4}-?[A-Za-z2-9]{4}$/.test(codigo.trim())) {
      return resposta(400, {
        erro: 'Código inválido. Ele tem 8 letras e números, como K7QF-2M9X.',
      });
    }
    const token = tokenAleatorio();
    const { data, error } = await admin.rpc('parear_aparelho', {
      p_codigo: codigo,
      p_nome: String(corpo.nome ?? '').slice(0, 60),
      p_token_hash: await sha256(token),
    });
    const loja = data?.[0];
    if (error) return resposta(500, { erro: 'Não foi possível conectar o aparelho agora.' });
    if (!loja)
      return resposta(404, { erro: 'Código não encontrado ou vencido. Peça um novo ao gerente.' });
    return resposta(200, { token, loja: loja.loja, restaurante: loja.restaurant_id });
  }

  if (corpo.acao === 'entrar') {
    const token = String(corpo.token ?? '');
    const pin = String(corpo.pin ?? '');
    if (!token) return resposta(400, { erro: 'Este aparelho não está conectado a nenhuma loja.' });
    const { data, error } = await admin.rpc('entrar_com_pin', {
      p_token_hash: await sha256(token),
      p_pin: pin,
    });
    const r = data?.[0];
    if (error || !r) return resposta(500, { erro: 'Não foi possível conferir o PIN agora.' });
    if (!r.ok) {
      // Aparelho desconectado pelo gerente: o app volta para a tela de conectar
      const desconectado = r.mensagem === 'Este aparelho não está conectado a nenhuma loja.';
      return resposta(401, { erro: r.mensagem, desconectado });
    }

    const { data: usuario } = await admin.auth.admin.getUserById(r.user_id);
    if (!usuario.user?.email)
      return resposta(500, { erro: 'Cadastro da pessoa incompleto. Fale com o gerente.' });
    const { data: link, error: erroLink } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: usuario.user.email,
    });
    if (erroLink || !link.properties?.hashed_token)
      return resposta(500, { erro: 'Não foi possível abrir o acesso agora.' });
    return resposta(200, {
      token_hash: link.properties.hashed_token,
      nome: r.nome,
      restaurante: r.restaurant_id,
    });
  }

  return resposta(400, { erro: 'Ação desconhecida.' });
});
