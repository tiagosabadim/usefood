import type { RegistroDns } from './provedor.ts';

/** Consulta pública de DNS (DNS over HTTPS do Google). */
async function consultar(nome: string, tipo: 'A' | 'CNAME'): Promise<string[]> {
  const url = `https://dns.google/resolve?name=${encodeURIComponent(nome)}&type=${tipo}`;
  const resposta = await fetch(url);
  if (!resposta.ok) return [];
  const corpo = (await resposta.json()) as { Answer?: { data: string }[] };
  return (corpo.Answer ?? []).map((r) => r.data.replace(/\.$/, '').toLowerCase());
}

/** Quais dos registros esperados já estão apontados. Basta um para o domínio funcionar. */
export async function registrosApontados(esperados: RegistroDns[]): Promise<RegistroDns[]> {
  const conferidos = await Promise.all(
    esperados.map(async (r) => ((await consultar(r.nome, r.tipo)).includes(r.valor) ? r : null)),
  );
  return conferidos.filter((r): r is RegistroDns => r !== null);
}
