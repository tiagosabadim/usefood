import { escposDoTicket, linhasDoTicket } from '@usefood/core';
import { hostname } from 'node:os';
import { iniciarAgente, VERSAO } from './agente';
import { ARQUIVO, lerConfiguracao, salvarConfiguracao } from './config';
import { enviarParaImpressora } from './impressora';

const hora = () => new Date().toLocaleTimeString('pt-BR', { hour12: false });
const log = (m: string) => console.log(`[${hora()}] ${m}`);
const opcao = (args: string[], nome: string) => {
  const i = args.indexOf(nome);
  return i >= 0 ? args[i + 1] : undefined;
};

const AJUDA = `usefood-impressao ${VERSAO}: imprime os pedidos da loja nas impressoras térmicas de rede.

Comandos:
  parear <CÓDIGO> --servidor <URL> [--nome "Computador do caixa"]
      Liga este computador à loja. O código e o comando completo aparecem no PDV.
  iniciar
      Começa a imprimir. Deixe rodando enquanto a loja estiver aberta.
  testar-impressora <IP> [porta]
      Imprime um ticket de teste direto na impressora, sem passar pelo sistema.
`;

async function principal(): Promise<void> {
  const [comando, ...args] = process.argv.slice(2);

  if (comando === 'parear') {
    const codigo = args[0];
    const servidor = (opcao(args, '--servidor') ?? process.env.USEFOOD_SERVIDOR)?.replace(
      /\/+$/,
      '',
    );
    if (!codigo || !servidor)
      throw new Error('Use: usefood-impressao parear <CÓDIGO> --servidor <URL>');
    const resposta = await fetch(`${servidor}/functions/v1/parear-impressora`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo, nome: opcao(args, '--nome') ?? hostname() }),
    });
    const corpo = (await resposta.json()) as {
      erro?: string;
      email: string;
      senha: string;
      url: string;
      chave: string;
      loja: string;
    };
    if (!resposta.ok) throw new Error(corpo.erro ?? 'Não foi possível parear.');
    await salvarConfiguracao({ ...corpo, nome: opcao(args, '--nome') ?? hostname() });
    console.log(
      `Pronto! Este computador agora imprime os pedidos de ${corpo.loja}.\nPara começar: usefood-impressao iniciar`,
    );
    return;
  }

  if (comando === 'iniciar') {
    const cfg = await lerConfiguracao();
    if (!cfg)
      throw new Error(
        `Este computador ainda não foi pareado (${ARQUIVO} não existe). Use o comando parear.`,
      );
    await iniciarAgente(cfg, log);
    return;
  }

  if (comando === 'testar-impressora') {
    const host = args[0];
    const porta = Number(args[1] ?? 9100);
    if (!host) throw new Error('Use: usefood-impressao testar-impressora <IP> [porta]');
    const linhas = linhasDoTicket(
      { tipo: 'teste', loja: 'usefood', praca: 'Teste', impressora: host, itens: [] },
      48,
    );
    await enviarParaImpressora(
      host,
      porta,
      escposDoTicket(linhas, { colunas: 48, pagina: 'cp850' }),
    );
    console.log(`Ticket de teste enviado para ${host}:${porta}.`);
    return;
  }

  console.log(AJUDA);
}

principal().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
