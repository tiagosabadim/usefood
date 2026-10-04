import { escposDoTicket, linhasDoTicket, type TicketPayload } from '@usefood/core';

export interface Reserva {
  payload: unknown;
  host: string;
  port: number;
  paper_width: number;
  codepage: string;
}

export interface Dependencias {
  pegar: (jobId: string) => Promise<Reserva | null>;
  concluir: (jobId: string, ok: boolean, erro?: string) => Promise<void>;
  imprimir: (host: string, port: number, bytes: Uint8Array) => Promise<void>;
  log: (mensagem: string) => void;
}

/** Reserva, formata, imprime e confirma uma ordem. Nunca deixa uma falha derrubar o agente. */
export async function processarImpressao(
  jobId: string,
  d: Dependencias,
): Promise<'impresso' | 'falhou' | 'ignorado'> {
  const reserva = await d.pegar(jobId);
  if (!reserva) return 'ignorado'; // outro computador pegou, ou já foi impressa

  const payload = reserva.payload as TicketPayload;
  const colunas = reserva.paper_width === 58 ? 32 : 48;
  try {
    const bytes = escposDoTicket(linhasDoTicket(payload, colunas), {
      colunas,
      pagina: reserva.codepage === 'ascii' ? 'ascii' : 'cp850',
    });
    await d.imprimir(reserva.host, reserva.port, bytes);
    await d.concluir(jobId, true);
    d.log(
      `Impresso: ${payload.praca}${payload.identificador ? ` · ${payload.identificador}` : ''}`,
    );
    return 'impresso';
  } catch (e) {
    const motivo = e instanceof Error ? e.message : 'Falha desconhecida';
    await d.concluir(jobId, false, motivo).catch(() => undefined);
    d.log(`Falhou (${payload.praca}): ${motivo}`);
    return 'falhou';
  }
}

/** Fila de uma ordem por vez: a mesma ordem nunca entra duas vezes ao mesmo tempo. */
export class Fila {
  private readonly ids = new Set<string>();
  private rodando = false;

  constructor(private readonly tarefa: (id: string) => Promise<unknown>) {}

  adicionar(id: string): void {
    if (this.ids.has(id)) return;
    this.ids.add(id);
    void this.rodar();
  }

  async esvaziar(): Promise<void> {
    while (this.rodando || this.ids.size) await new Promise((r) => setTimeout(r, 5));
  }

  private async rodar(): Promise<void> {
    if (this.rodando) return;
    this.rodando = true;
    try {
      while (this.ids.size) {
        const [id] = this.ids;
        this.ids.delete(id!);
        await this.tarefa(id!).catch(() => undefined);
      }
    } finally {
      this.rodando = false;
    }
  }
}
