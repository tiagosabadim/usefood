/** O que o banco manda para imprimir (print_jobs.payload). */
export interface TicketPayload {
  tipo: 'pedido' | 'reimpressao' | 'teste';
  loja: string;
  praca: string;
  impressora?: string;
  numero?: number;
  pedido_tipo?: 'balcao' | 'mesa' | 'retirada' | 'delivery';
  identificador_tipo?: 'senha' | 'nome' | 'mesa' | 'comanda';
  identificador?: string;
  criado_em?: string;
  observacao?: string | null;
  itens: {
    quantidade: number;
    nome: string;
    tamanho: string | null;
    adicionais: string[];
    observacao: string | null;
  }[];
}

export type Linha =
  | { tipo: 'texto'; texto: string; estilo?: 'normal' | 'negrito' | 'grande'; centro?: boolean }
  | { tipo: 'separador' }
  | { tipo: 'espaco' };

const TIPO_DO_PEDIDO = {
  balcao: 'Balcão',
  mesa: 'Mesa',
  retirada: 'Retirada',
  delivery: 'Delivery',
} as const;

/** Quebra o texto em linhas de até `largura` caracteres, sem cortar palavras quando possível. */
export function quebrar(texto: string, largura: number, recuo = ''): string[] {
  const linhas: string[] = [];
  let atual = '';
  for (const palavra of texto.trim().split(/\s+/)) {
    const candidata = atual ? `${atual} ${palavra}` : palavra;
    if (candidata.length <= largura) {
      atual = candidata;
      continue;
    }
    if (atual) linhas.push(atual);
    let resto = palavra;
    while (resto.length > largura - recuo.length) {
      linhas.push((linhas.length ? recuo : '') + resto.slice(0, largura - recuo.length));
      resto = resto.slice(largura - recuo.length);
    }
    atual = (linhas.length ? recuo : '') + resto;
  }
  if (atual) linhas.push(atual);
  return linhas.length ? linhas : [''];
}

function destaque(p: TicketPayload): string {
  const id = p.identificador ?? '';
  if (p.identificador_tipo === 'senha') return `SENHA ${id}`;
  if (p.identificador_tipo === 'mesa') return `MESA ${id}`;
  if (p.identificador_tipo === 'comanda') return `COMANDA ${id}`;
  return id.toUpperCase();
}

/**
 * Monta o ticket da cozinha em linhas. 48 colunas no papel de 80 mm, 32 no de 58 mm.
 * O texto "grande" ocupa o dobro da largura, então cabe metade das colunas.
 */
export function linhasDoTicket(p: TicketPayload, colunas: 32 | 48): Linha[] {
  const linhas: Linha[] = [];
  const texto = (t: string, estilo: 'normal' | 'negrito' | 'grande' = 'normal', centro = false) => {
    const largura = estilo === 'grande' ? Math.floor(colunas / 2) : colunas;
    for (const l of quebrar(t, largura)) linhas.push({ tipo: 'texto', texto: l, estilo, centro });
  };

  texto(p.praca.toUpperCase(), 'negrito', true);

  if (p.tipo === 'teste') {
    texto(p.loja, 'normal', true);
    linhas.push({ tipo: 'separador' });
    texto('TESTE DE IMPRESSÃO', 'grande', true);
    texto(`Impressora: ${p.impressora ?? ''}`, 'normal', true);
    texto('Acentos: ação, pão, feijão, açaí, café', 'normal', true);
    linhas.push({ tipo: 'separador' });
    return linhas;
  }

  texto(destaque(p), 'grande', true);
  const numero = p.numero ? `Pedido #${String(p.numero).padStart(3, '0')}` : '';
  const tipo = p.pedido_tipo ? TIPO_DO_PEDIDO[p.pedido_tipo] : '';
  texto([numero, tipo, p.criado_em].filter(Boolean).join(' · '), 'normal', true);
  if (p.tipo === 'reimpressao') texto('** REIMPRESSÃO **', 'negrito', true);
  linhas.push({ tipo: 'separador' });

  for (const item of p.itens) {
    texto(`${item.quantidade}x ${item.nome}`, 'negrito');
    const recuo = '   ';
    if (item.tamanho)
      for (const l of quebrar(item.tamanho, colunas - recuo.length))
        linhas.push({ tipo: 'texto', texto: recuo + l });
    for (const a of item.adicionais) {
      for (const l of quebrar(`+ ${a}`, colunas - recuo.length))
        linhas.push({ tipo: 'texto', texto: recuo + l });
    }
    if (item.observacao) {
      for (const l of quebrar(`>> ${item.observacao}`, colunas - recuo.length)) {
        linhas.push({ tipo: 'texto', texto: recuo + l, estilo: 'negrito' });
      }
    }
    linhas.push({ tipo: 'espaco' });
  }

  if (p.observacao) {
    linhas.push({ tipo: 'separador' });
    texto(`OBS: ${p.observacao}`, 'negrito');
  }
  linhas.push({ tipo: 'separador' });
  texto(p.loja, 'normal', true);
  return linhas;
}

// --- ESC/POS ------------------------------------------------------------------

/** Letras do português na página de código 850 (padrão das térmicas Epson, Elgin e Bematech). */
const CP850: Record<string, number> = {
  á: 0xa0,
  à: 0x85,
  â: 0x83,
  ã: 0xc6,
  ä: 0x84,
  é: 0x82,
  è: 0x8a,
  ê: 0x88,
  í: 0xa1,
  ì: 0x8d,
  î: 0x8c,
  ó: 0xa2,
  ò: 0x95,
  ô: 0x93,
  õ: 0xe4,
  ö: 0x94,
  ú: 0xa3,
  ù: 0x97,
  û: 0x96,
  ü: 0x81,
  ç: 0x87,
  ñ: 0xa4,
  Á: 0xb5,
  À: 0xb7,
  Â: 0xb6,
  Ã: 0xc7,
  É: 0x90,
  Ê: 0xd2,
  Í: 0xd6,
  Ó: 0xe0,
  Ô: 0xe2,
  Õ: 0xe5,
  Ú: 0xe9,
  Ü: 0x9a,
  Ç: 0x80,
  Ñ: 0xa5,
  º: 0xa7,
  ª: 0xa6,
  '·': 0xfa,
  '×': 0x9e,
};
const TROCAS: Record<string, string> = {
  '–': '-',
  '—': '-',
  '“': '"',
  '”': '"',
  '‘': "'",
  '’': "'",
  '…': '...',
};

/** Converte texto para bytes da impressora; o que não existe vira a letra sem acento (ou "?"). */
export function codificar(texto: string, pagina: 'cp850' | 'ascii'): number[] {
  const bytes: number[] = [];
  for (const caractere of texto) {
    const troca = TROCAS[caractere];
    if (troca !== undefined) {
      // Trocas são sempre ASCII ("…" vira "..."), então não há risco de laço
      bytes.push(...codificar(troca, 'ascii'));
      continue;
    }
    const c = caractere;
    const codigo = c.codePointAt(0) ?? 0x3f;
    if (codigo < 0x80) bytes.push(codigo);
    else if (pagina === 'cp850' && CP850[c] !== undefined) bytes.push(CP850[c]!);
    else {
      const semAcento = c.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      bytes.push(semAcento && semAcento.charCodeAt(0) < 0x80 ? semAcento.charCodeAt(0) : 0x3f);
    }
  }
  return bytes;
}

const ESC = 0x1b;
const GS = 0x1d;

/** Bytes ESC/POS do ticket: inicia, escolhe a página de código, imprime, avança e corta. */
export function escposDoTicket(
  linhas: Linha[],
  opcoes: { colunas: 32 | 48; pagina: 'cp850' | 'ascii' },
): Uint8Array {
  const b: number[] = [ESC, 0x40]; // inicializa
  if (opcoes.pagina === 'cp850') b.push(ESC, 0x74, 2); // página 850
  for (const l of linhas) {
    if (l.tipo === 'separador') {
      b.push(ESC, 0x61, 0, ...codificar('-'.repeat(opcoes.colunas), 'ascii'), 0x0a);
    } else if (l.tipo === 'espaco') {
      b.push(0x0a);
    } else {
      b.push(ESC, 0x61, l.centro ? 1 : 0);
      b.push(ESC, 0x45, l.estilo === 'negrito' || l.estilo === 'grande' ? 1 : 0);
      b.push(GS, 0x21, l.estilo === 'grande' ? 0x11 : 0x00);
      b.push(...codificar(l.texto, opcoes.pagina), 0x0a);
    }
  }
  b.push(GS, 0x21, 0, ESC, 0x45, 0, ESC, 0x61, 0); // volta ao normal
  b.push(0x0a, 0x0a, 0x0a, GS, 0x56, 0x42, 0x00); // avança e corta
  return Uint8Array.from(b);
}
