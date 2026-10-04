import { describe, expect, it } from 'vitest';
import { codificar, escposDoTicket, linhasDoTicket, quebrar, type TicketPayload } from './ticket';

const pedido: TicketPayload = {
  tipo: 'pedido',
  loja: 'Pastelaria do Zé',
  praca: 'Cozinha',
  numero: 47,
  pedido_tipo: 'balcao',
  identificador_tipo: 'senha',
  identificador: '047',
  criado_em: '02/10 18:42',
  observacao: null,
  itens: [
    {
      quantidade: 2,
      nome: 'Pastel de feijão',
      tamanho: null,
      adicionais: [],
      observacao: 'bem passado',
    },
    {
      quantidade: 1,
      nome: 'Pizza',
      tamanho: 'Grande',
      adicionais: ['Catupiry', 'Bacon'],
      observacao: null,
    },
  ],
};
const textos = (p: TicketPayload, c: 32 | 48) =>
  linhasDoTicket(p, c).flatMap((l) => (l.tipo === 'texto' ? [l.texto] : []));

describe('linhasDoTicket', () => {
  it('praça, senha em destaque e itens com tamanho, adicionais e observação', () => {
    const t = textos(pedido, 48);
    expect(t[0]).toBe('COZINHA');
    expect(t).toContain('SENHA 047');
    expect(t).toContain('Pedido #047 · Balcão · 02/10 18:42');
    expect(t).toContain('2x Pastel de feijão');
    expect(t).toContain('   >> bem passado');
    expect(t).toContain('   Grande');
    expect(t).toContain('   + Catupiry');
  });

  it('mesa e nome viram o destaque', () => {
    expect(textos({ ...pedido, identificador_tipo: 'mesa', identificador: '12' }, 48)).toContain(
      'MESA 12',
    );
    expect(textos({ ...pedido, identificador_tipo: 'nome', identificador: 'João' }, 48)).toContain(
      'JOÃO',
    );
  });

  it('reimpressão é marcada', () => {
    expect(textos({ ...pedido, tipo: 'reimpressao' }, 48)).toContain('** REIMPRESSÃO **');
  });

  it('nenhuma linha passa da largura do papel de 58 mm', () => {
    const longo = {
      ...pedido,
      itens: [{ ...pedido.itens[0]!, nome: 'Pastel de carne seca com abóbora e catupiry extra' }],
    };
    for (const l of linhasDoTicket(longo, 32)) {
      if (l.tipo === 'texto')
        expect(l.texto.length).toBeLessThanOrEqual(l.estilo === 'grande' ? 16 : 32);
    }
  });
});

describe('quebrar', () => {
  it('quebra entre palavras', () => {
    expect(quebrar('Pastel de carne seca com abóbora', 16)).toEqual([
      'Pastel de carne',
      'seca com abóbora',
    ]);
  });
});

describe('codificar', () => {
  it('acentos do português na página 850', () => {
    expect(codificar('ção', 'cp850')).toEqual([0x87, 0xc6, 0x6f]);
    expect(codificar('AÇAÍ', 'cp850')).toEqual([0x41, 0x80, 0x41, 0xd6]);
  });

  it('em ASCII, tira os acentos', () => {
    expect(String.fromCharCode(...codificar('Feijão', 'ascii'))).toBe('Feijao');
  });

  it('emoji e símbolos desconhecidos viram ?, sem travar', () => {
    expect(codificar('😀', 'cp850')).toEqual([0x3f]);
    expect(codificar('sem cebola 😀…', 'cp850').slice(-4)).toEqual([0x3f, 0x2e, 0x2e, 0x2e]);
  });
});

describe('escposDoTicket', () => {
  it('começa inicializando e termina cortando', () => {
    const bytes = escposDoTicket(linhasDoTicket(pedido, 48), { colunas: 48, pagina: 'cp850' });
    expect([...bytes.slice(0, 5)]).toEqual([0x1b, 0x40, 0x1b, 0x74, 2]);
    expect([...bytes.slice(-4)]).toEqual([0x1d, 0x56, 0x42, 0x00]);
  });
});

describe('para viagem no ticket', () => {
  const item = {
    quantidade: 1,
    nome: 'X-Burguer',
    tamanho: null,
    adicionais: [],
    observacao: null,
  };
  const linhas = (itens: TicketPayload['itens'], tipo: TicketPayload['pedido_tipo'] = 'mesa') =>
    linhasDoTicket({ ...pedido, pedido_tipo: tipo, itens }, 48).flatMap((l) =>
      l.tipo === 'texto' ? [l] : [],
    );

  it('pedido todo para viagem ganha a faixa grande invertida', () => {
    const faixa = linhas([{ ...item, para_viagem: true }]).find((l) =>
      l.texto.includes('PARA VIAGEM'),
    );
    expect(faixa).toMatchObject({ estilo: 'grande', invertido: true, centro: true });
  });

  it('delivery escreve DELIVERY na faixa', () => {
    expect(
      linhas([{ ...item, para_viagem: true }], 'delivery').some(
        (l) => l.texto.includes('DELIVERY') && l.invertido,
      ),
    ).toBe(true);
  });

  it('misturado: aviso no topo e marca só no item para viagem', () => {
    const l = linhas([item, { ...item, nome: 'Batata', para_viagem: true }]);
    expect(l.some((x) => x.texto.includes('TEM ITEM PARA VIAGEM'))).toBe(true);
    expect(l.filter((x) => x.texto.trim() === 'PARA VIAGEM')).toHaveLength(1);
  });

  it('sem para viagem, nenhuma faixa', () => {
    expect(linhas([item]).some((x) => x.texto.includes('VIAGEM'))).toBe(false);
  });

  it('o comando de inverter vai para a impressora', () => {
    const bytes = [
      ...escposDoTicket(
        linhasDoTicket({ ...pedido, itens: [{ ...item, para_viagem: true }] }, 48),
        { colunas: 48, pagina: 'cp850' },
      ),
    ];
    const inverte = bytes.findIndex(
      (b, i) => b === 0x1d && bytes[i + 1] === 0x42 && bytes[i + 2] === 1,
    );
    expect(inverte).toBeGreaterThan(0);
  });
});
