// Contrato com o parceiro que liga domínios ao site. Hoje: Netlify.
// Para trocar (Cloudflare for SaaS, por exemplo), crie outro arquivo que implemente
// `ProvedorDeDominios` e mude DOMINIOS_PROVEDOR; o resto da função não muda.

export interface RegistroDns {
  tipo: 'A' | 'CNAME';
  nome: string;
  valor: string;
}

export interface ProvedorDeDominios {
  nome: string;
  /** Liga o domínio e o www ao site. Recusa quando o provedor está no limite. */
  adicionar(dominio: string): Promise<void>;
  remover(dominio: string): Promise<void>;
  /** O que o cliente precisa configurar no DNS dele. */
  registrosDns(dominio: string): RegistroDns[];
  /** Depois do DNS apontado, pede o certificado SSL. */
  ativarSsl(): Promise<void>;
}

export class LimiteDoProvedor extends Error {}

/** Netlify recomenda até 50 nomes por site; cada domínio usa 2 (com e sem www). */
const LIMITE_NETLIFY = 50;
/** IP do balanceador do Netlify para o domínio sem www. */
const IP_NETLIFY = '75.2.60.5';

export function netlify(env: {
  token: string;
  siteId: string;
  siteHost: string;
}): ProvedorDeDominios {
  const api = async (caminho: string, init: RequestInit = {}) => {
    const resposta = await fetch(`https://api.netlify.com/api/v1${caminho}`, {
      ...init,
      headers: { Authorization: `Bearer ${env.token}`, 'Content-Type': 'application/json' },
    });
    if (!resposta.ok)
      throw new Error(`Netlify respondeu ${resposta.status}: ${await resposta.text()}`);
    return resposta.status === 204 ? null : resposta.json();
  };

  const aliasAtuais = async (): Promise<string[]> =>
    ((await api(`/sites/${env.siteId}`)) as { domain_aliases?: string[] }).domain_aliases ?? [];

  const salvar = (aliases: string[]) =>
    api(`/sites/${env.siteId}`, {
      method: 'PATCH',
      body: JSON.stringify({ domain_aliases: aliases }),
    });

  return {
    nome: 'netlify',
    async adicionar(dominio) {
      const atuais = await aliasAtuais();
      const novos = [...new Set([...atuais, dominio, `www.${dominio}`])];
      if (novos.length > LIMITE_NETLIFY) {
        throw new LimiteDoProvedor(
          `O site já tem ${atuais.length} domínios; o Netlify recomenda até ${LIMITE_NETLIFY}. ` +
            'Hora de migrar os domínios próprios para outro provedor.',
        );
      }
      await salvar(novos);
    },
    async remover(dominio) {
      const restantes = (await aliasAtuais()).filter(
        (h) => h !== dominio && h !== `www.${dominio}`,
      );
      await salvar(restantes);
    },
    registrosDns(dominio) {
      return [
        { tipo: 'A', nome: dominio, valor: IP_NETLIFY },
        { tipo: 'CNAME', nome: `www.${dominio}`, valor: env.siteHost },
      ];
    },
    async ativarSsl() {
      await api(`/sites/${env.siteId}/ssl`, { method: 'POST' });
    },
  };
}
