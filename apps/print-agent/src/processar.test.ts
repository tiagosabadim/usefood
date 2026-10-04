import { describe, expect, it, vi } from 'vitest';
import { Fila, processarImpressao, type Dependencias, type Reserva } from './processar';

const reserva: Reserva = {
  payload: {
    tipo: 'pedido',
    loja: 'Pastelaria',
    praca: 'Cozinha',
    numero: 3,
    identificador_tipo: 'senha',
    identificador: '003',
    itens: [{ quantidade: 1, nome: 'Pastel', tamanho: null, adicionais: [], observacao: null }],
  },
  host: '192.168.0.50',
  port: 9100,
  paper_width: 80,
  codepage: 'cp850',
};

function deps(sobrescrever: Partial<Dependencias> = {}): Dependencias {
  return {
    pegar: vi.fn(async () => reserva),
    concluir: vi.fn(async () => undefined),
    imprimir: vi.fn(async () => undefined),
    log: vi.fn(),
    ...sobrescrever,
  };
}

describe('processarImpressao', () => {
  it('imprime na impressora reservada e confirma', async () => {
    const d = deps();
    expect(await processarImpressao('j1', d)).toBe('impresso');
    expect(d.imprimir).toHaveBeenCalledWith('192.168.0.50', 9100, expect.any(Uint8Array));
    expect(d.concluir).toHaveBeenCalledWith('j1', true);
  });

  it('falha na impressora devolve a ordem com o motivo', async () => {
    const d = deps({
      imprimir: vi.fn(async () => Promise.reject(new Error('A impressora não respondeu.'))),
    });
    expect(await processarImpressao('j1', d)).toBe('falhou');
    expect(d.concluir).toHaveBeenCalledWith('j1', false, 'A impressora não respondeu.');
  });

  it('ordem já pega por outro computador é ignorada', async () => {
    const d = deps({ pegar: vi.fn(async () => null) });
    expect(await processarImpressao('j1', d)).toBe('ignorado');
    expect(d.imprimir).not.toHaveBeenCalled();
  });
});

describe('Fila', () => {
  it('a mesma ordem adicionada duas vezes roda uma vez só', async () => {
    const tarefa = vi.fn(async () => new Promise((r) => setTimeout(r, 10)));
    const fila = new Fila(tarefa);
    fila.adicionar('a');
    fila.adicionar('b');
    fila.adicionar('b');
    await fila.esvaziar();
    expect(tarefa).toHaveBeenCalledTimes(2);
  });
});
