// Edge Function `equipe-gestao`: o dono ou o gerente (logado) adiciona e remove pessoas
// da equipe que entram só com PIN, sem e-mail.
//   { acao: "adicionar", loja, nome, papel, pin }
//   { acao: "remover", loja, pessoa }
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
const DOMINIO_DA_EQUIPE = '@equipe.usefood.app';
const PAPEIS = ['garcom', 'caixa', 'cozinha', 'entregador', 'gerente'] as const;

function senhaAleatoria(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return resposta(405, { erro: 'Use POST' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  // Cliente com o login de quem chamou: as regras do banco decidem o que ele pode
  const usuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });

  let corpo: Record<string, unknown>;
  try {
    corpo = await req.json();
  } catch {
    return resposta(400, { erro: 'Pedido inválido.' });
  }
  const loja = String(corpo.loja ?? '');

  // Só dono e gerente recebem a lista da equipe; ela também diz o papel de quem chamou
  const { data: equipe } = await usuario.rpc('membros_da_equipe', { p_restaurant_id: loja });
  const eu = equipe?.find((m: { e_voce: boolean }) => m.e_voce);
  if (!eu) return resposta(403, { erro: 'Só o dono ou o gerente mexem na equipe.' });

  if (corpo.acao === 'adicionar') {
    const nome = String(corpo.nome ?? '')
      .trim()
      .slice(0, 40);
    const papel = String(corpo.papel ?? '');
    const pin = String(corpo.pin ?? '');
    if (!nome) return resposta(400, { erro: 'Digite o nome da pessoa.' });
    if (!(PAPEIS as readonly string[]).includes(papel))
      return resposta(400, { erro: 'Função inválida.' });
    if (papel === 'gerente' && eu.papel !== 'dono')
      return resposta(403, { erro: 'Só o dono adiciona gerentes.' });
    if (!/^[0-9]{4}$/.test(pin)) return resposta(400, { erro: 'O PIN tem 4 números.' });

    const { data: criado, error: erroUsuario } = await admin.auth.admin.createUser({
      email: `equipe-${crypto.randomUUID()}${DOMINIO_DA_EQUIPE}`,
      password: senhaAleatoria(),
      email_confirm: true,
      app_metadata: { tipo: 'equipe' },
      user_metadata: { nome },
    });
    if (erroUsuario || !criado.user)
      return resposta(500, { erro: 'Não foi possível adicionar a pessoa agora.' });
    const pessoa = criado.user.id;

    const { error: erroVinculo } = await admin
      .from('memberships')
      .insert({ restaurant_id: loja, user_id: pessoa, role: papel });
    const { error: erroPin } = erroVinculo
      ? { error: erroVinculo }
      : await usuario.rpc('definir_pin', {
          p_restaurant_id: loja,
          p_user_id: pessoa,
          p_pin: pin,
          p_nome: nome,
        });
    if (erroVinculo || erroPin) {
      await admin.from('memberships').delete().eq('restaurant_id', loja).eq('user_id', pessoa);
      await admin.auth.admin.deleteUser(pessoa);
      const duplicado = erroPin?.code === '23505';
      return resposta(duplicado ? 409 : 500, {
        erro: duplicado
          ? 'Este PIN já é de outra pessoa da equipe. Escolha outro.'
          : 'Não foi possível adicionar a pessoa agora.',
      });
    }
    return resposta(200, { pessoa });
  }

  if (corpo.acao === 'remover') {
    const pessoa = String(corpo.pessoa ?? '');
    const { error } = await usuario.rpc('remover_da_equipe', {
      p_restaurant_id: loja,
      p_user_id: pessoa,
    });
    if (error) return resposta(400, { erro: error.message });
    // Quem entrava só com PIN e não está em mais nenhuma loja tem o acesso apagado
    const { data: alvo } = await admin.auth.admin.getUserById(pessoa);
    const { count } = await admin
      .from('memberships')
      .select('user_id', { count: 'exact', head: true })
      .eq('user_id', pessoa);
    if (alvo.user?.email?.endsWith(DOMINIO_DA_EQUIPE) && (count ?? 0) === 0)
      await admin.auth.admin.deleteUser(pessoa);
    return resposta(200, { ok: true });
  }

  return resposta(400, { erro: 'Ação desconhecida.' });
});
