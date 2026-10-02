// Edge Function `dominios`: conecta, verifica e remove domínios próprios de marcas e lojas.
//
// POST { acao: 'conectar', dominio, marca }          → vitrine de uma marca (master ou franqueado)
// POST { acao: 'conectar', dominio, loja }           → domínio de uma loja (dono, franqueado ou master)
// POST { acao: 'verificar', dominio }                → confere o DNS e, se ok, ativa e pede o SSL
// POST { acao: 'remover', dominio }
//
// Segredos (supabase secrets set): NETLIFY_AUTH_TOKEN, NETLIFY_SITE_ID, NETLIFY_SITE_HOST
import { createClient } from 'npm:@supabase/supabase-js@2';
import { registrosApontados } from './dns.ts';
import { LimiteDoProvedor, netlify, type ProvedorDeDominios } from './provedor.ts';

type Pedido =
  | { acao: 'conectar'; dominio: string; marca?: string; loja?: string }
  | { acao: 'verificar' | 'remover'; dominio: string };

const FORMATO = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

function provedor(): ProvedorDeDominios {
  const nome = Deno.env.get('DOMINIOS_PROVEDOR') ?? 'netlify';
  if (nome !== 'netlify') throw new Error(`Provedor de domínios desconhecido: ${nome}`);
  return netlify({
    token: Deno.env.get('NETLIFY_AUTH_TOKEN') ?? '',
    siteId: Deno.env.get('NETLIFY_SITE_ID') ?? '',
    siteHost: Deno.env.get('NETLIFY_SITE_HOST') ?? '',
  });
}

const resposta = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return resposta(204, null);
  if (req.method !== 'POST') return resposta(405, { erro: 'Use POST' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Quem está pedindo
  const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
  const { data: auth } = await admin.auth.getUser(token);
  const usuario = auth.user?.id;
  if (!usuario) return resposta(401, { erro: 'Entre na sua conta para conectar um domínio' });

  const pedido = (await req.json()) as Pedido;
  const dominio = pedido.dominio
    ?.trim()
    .toLowerCase()
    .replace(/^www\./, '')
    .replace(/\/.*$/, '');
  if (!dominio || !FORMATO.test(dominio)) {
    return resposta(400, { erro: 'Domínio inválido. Exemplo: ranchopasteis.com.br' });
  }

  // Permissões (lidas com a service role; o RLS não se aplica aqui)
  const ehMaster = async () =>
    !!(await admin.from('platform_admins').select('user_id').eq('user_id', usuario).maybeSingle())
      .data;
  const cuidaDaMarca = async (brandId: string) =>
    (await ehMaster()) ||
    !!(
      await admin
        .from('brand_members')
        .select('user_id')
        .eq('brand_id', brandId)
        .eq('user_id', usuario)
        .maybeSingle()
    ).data;
  const cuidaDaLoja = async (restaurantId: string, brandId: string) =>
    (await cuidaDaMarca(brandId)) ||
    !!(
      await admin
        .from('memberships')
        .select('role')
        .eq('restaurant_id', restaurantId)
        .eq('user_id', usuario)
        .eq('role', 'dono')
        .maybeSingle()
    ).data;

  const p = provedor();

  try {
    if (pedido.acao === 'conectar') {
      let brandId: string;
      let restaurantId: string | null = null;

      if (pedido.loja) {
        const { data: loja } = await admin
          .from('restaurants')
          .select('id, brand_id')
          .eq('id', pedido.loja)
          .maybeSingle();
        if (!loja) return resposta(404, { erro: 'Loja não encontrada' });
        if (!(await cuidaDaLoja(loja.id, loja.brand_id))) {
          return resposta(403, { erro: 'Só o dono da loja conecta o domínio dela' });
        }
        brandId = loja.brand_id;
        restaurantId = loja.id;
      } else if (pedido.marca) {
        const { data: marca } = await admin
          .from('brands')
          .select('id')
          .eq('slug', pedido.marca)
          .maybeSingle();
        if (!marca) return resposta(404, { erro: 'Marca não encontrada' });
        if (!(await cuidaDaMarca(marca.id))) {
          return resposta(403, {
            erro: 'Só a plataforma ou o franqueado conecta o domínio da marca',
          });
        }
        brandId = marca.id;
      } else {
        return resposta(400, { erro: 'Informe a marca ou a loja do domínio' });
      }

      const { error } = await admin.from('domains').insert({
        hostname: dominio,
        brand_id: brandId,
        kind: restaurantId ? 'loja' : 'marca',
        restaurant_id: restaurantId,
        status: 'verificando',
        provider: p.nome,
      });
      if (error) {
        return resposta(409, {
          erro: error.code === '23505' ? 'Esse domínio já está cadastrado' : error.message,
        });
      }

      try {
        await p.adicionar(dominio);
      } catch (e) {
        await admin.from('domains').delete().eq('hostname', dominio);
        throw e;
      }

      return resposta(200, {
        status: 'verificando',
        mensagem: 'Configure um destes registros no DNS do domínio e depois clique em verificar.',
        registros: p.registrosDns(dominio),
      });
    }

    // verificar e remover: precisa existir e o usuário precisa cuidar dele
    const { data: linha } = await admin
      .from('domains')
      .select('id, brand_id, restaurant_id, status')
      .eq('hostname', dominio)
      .maybeSingle();
    if (!linha) return resposta(404, { erro: 'Domínio não cadastrado' });
    const permitido = linha.restaurant_id
      ? await cuidaDaLoja(linha.restaurant_id, linha.brand_id)
      : await cuidaDaMarca(linha.brand_id);
    if (!permitido) return resposta(403, { erro: 'Você não cuida desse domínio' });

    if (pedido.acao === 'remover') {
      await p.remover(dominio);
      await admin.from('domains').delete().eq('id', linha.id);
      return resposta(200, { status: 'removido' });
    }

    const apontados = await registrosApontados(p.registrosDns(dominio));
    if (apontados.length === 0) {
      await admin
        .from('domains')
        .update({ status: 'verificando', last_error: 'DNS ainda não aponta para a plataforma' })
        .eq('id', linha.id);
      return resposta(200, {
        status: 'verificando',
        mensagem:
          'O DNS ainda não aponta para a plataforma. A propagação pode levar algumas horas.',
        registros: p.registrosDns(dominio),
      });
    }

    await p.ativarSsl();
    await admin
      .from('domains')
      .update({ status: 'ativo', last_error: null, verified_at: new Date().toISOString() })
      .eq('id', linha.id);
    return resposta(200, {
      status: 'ativo',
      mensagem: 'Domínio conectado. O SSL fica pronto em alguns minutos.',
    });
  } catch (e) {
    if (e instanceof LimiteDoProvedor) return resposta(507, { erro: e.message });
    return resposta(500, { erro: e instanceof Error ? e.message : 'Erro inesperado' });
  }
});
