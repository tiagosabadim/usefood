import { createSupabaseClient } from '@usefood/db';
import type { Configuracao } from './config';
import { enviarParaImpressora } from './impressora';
import { Fila, processarImpressao, type Dependencias } from './processar';

export const VERSAO = '0.1.0';
const PRESENCA_MS = 15_000;
const VARREDURA_MS = 10_000;

/** Entra com o acesso deste computador, escuta a fila da loja e imprime o que chegar. */
export async function iniciarAgente(cfg: Configuracao, log: (m: string) => void): Promise<void> {
  const supabase = createSupabaseClient(cfg.url, cfg.chave);
  const { error: erroLogin } = await supabase.auth.signInWithPassword({
    email: cfg.email,
    password: cfg.senha,
  });
  if (erroLogin)
    throw new Error(
      'Não foi possível entrar. Este computador foi desligado no PDV? Pareie de novo.',
    );

  const { data: lojaId, error: erroPresenca } = await supabase.rpc('agente_presente', {
    p_versao: VERSAO,
  });
  if (erroPresenca || !lojaId)
    throw new Error('Este computador não está mais ligado a nenhuma loja. Pareie de novo.');

  const deps: Dependencias = {
    pegar: async (id) => {
      const { data, error } = await supabase.rpc('pegar_impressao', { p_job: id });
      if (error) throw new Error(error.message);
      return data[0] ?? null;
    },
    concluir: async (id, ok, erro) => {
      await supabase.rpc('concluir_impressao', { p_job: id, p_ok: ok, p_erro: erro ?? null });
    },
    imprimir: (host, port, bytes) => enviarParaImpressora(host, port, bytes),
    log,
  };
  const fila = new Fila((id) => processarImpressao(id, deps));

  // Varredura: pega o que ficou pendente (inclusive novas tentativas depois de uma falha)
  const varrer = async () => {
    const { data } = await supabase
      .from('print_jobs')
      .select('id')
      .eq('restaurant_id', lojaId)
      .eq('status', 'pendente')
      .not('printer_id', 'is', null)
      .order('created_at')
      .limit(50);
    for (const job of data ?? []) fila.adicionar(job.id);
  };
  await varrer();

  supabase
    .channel(`impressao-${lojaId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'print_jobs',
        filter: `restaurant_id=eq.${lojaId}`,
      },
      (mudanca) => {
        const novo = mudanca.new as { id: string; status: string; printer_id: string | null };
        if (novo.status === 'pendente' && novo.printer_id) fila.adicionar(novo.id);
      },
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') log('Recebendo pedidos em tempo real.');
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')
        log('Tempo real caiu; seguindo pela varredura a cada 10 s.');
    });

  setInterval(() => void supabase.rpc('agente_presente', { p_versao: VERSAO }), PRESENCA_MS);
  setInterval(() => void varrer(), VARREDURA_MS);
  log(`Conectado à loja ${cfg.loja}. Aguardando pedidos…`);
}
