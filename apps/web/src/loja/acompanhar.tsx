import { useAppContext } from '@usefood/app';
import { etapasDoPedido, formatarPreco, fraseDoPedido, type SituacaoDoPedido } from '@usefood/core';
import { Alert, Button, cn, Icon, Panel } from '@usefood/ui';
import { useEffect, useState } from 'react';
import { navegar } from '../rotas';
import { whatsapp } from './dados';

interface Acompanhamento {
  loja: { nome: string; slug: string; telefone: string | null };
  numero: number;
  tipo: string;
  situacao: SituacaoDoPedido;
  motivo: string | null;
  tempo: { min: number; max: number };
  itens: {
    quantidade: number;
    nome: string;
    tamanho: string | null;
    total: number;
    adicionais: string[];
  }[];
  subtotal: number;
  taxa_entrega: number;
  total: number;
  pagamento: { metodo: string | null; troco_para: number | null };
  endereco: { rua?: string; numero?: string; bairro?: string; complemento?: string } | null;
  codigo_entrega: string | null;
}

const PAGAMENTO: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  credito: 'Cartão de crédito',
  debito: 'Cartão de débito',
};

/** Página do cliente para acompanhar o pedido pelo link secreto. Atualiza sozinha. */
// Etapa com nome curto e ícone (a linha do tempo na horizontal); o nome completo vai para o leitor de tela
const ETAPA_CURTA: Record<
  string,
  { texto: string; icone: 'relogio' | 'check' | 'cozinha' | 'sacola' | 'moto' | 'inicio' }
> = {
  'Aguardando o restaurante aceitar': { texto: 'Enviado', icone: 'relogio' },
  'Pedido aceito': { texto: 'Aceito', icone: 'check' },
  'Em preparação': { texto: 'Preparo', icone: 'cozinha' },
  Pronto: { texto: 'Pronto', icone: 'sacola' },
  'Pronto para retirar': { texto: 'Pronto', icone: 'sacola' },
  'Pedido a caminho': { texto: 'A caminho', icone: 'moto' },
  'Pedido entregue': { texto: 'Entregue', icone: 'inicio' },
  Retirado: { texto: 'Retirado', icone: 'check' },
};

export function Acompanhar({ token, voltar }: { token: string; voltar: string }) {
  const { supabase } = useAppContext();
  const [pedido, setPedido] = useState<Acompanhamento | null | undefined>(undefined);

  useEffect(() => {
    if (!supabase) return;
    let ativo = true;
    const carregar = async () => {
      const { data } = await supabase.rpc('acompanhar_pedido', { p_token: token });
      if (ativo) setPedido((data as Acompanhamento | null) ?? null);
    };
    void carregar();
    const t = setInterval(() => void carregar(), 10_000);
    return () => {
      ativo = false;
      clearInterval(t);
    };
  }, [supabase, token]);

  if (pedido === undefined)
    return (
      <main className="mx-auto max-w-xl px-5 py-10 text-body text-ink-muted">
        Abrindo o seu pedido…
      </main>
    );
  if (pedido === null) {
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-4 px-5 py-10">
        <h1 className="font-display text-title-screen text-ink">Pedido não encontrado</h1>
        <p className="text-body text-ink-muted">Confira o link que você recebeu.</p>
      </main>
    );
  }

  const cancelado = pedido.situacao === 'cancelado';
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-5 px-5 py-6">
      <button
        type="button"
        className="self-start text-label text-ink-muted"
        onClick={() => navegar(voltar)}
      >
        ← {pedido.loja.nome}
      </button>
      <header className="flex flex-col gap-1">
        <span className="text-caption text-ink-muted">
          Pedido #{String(pedido.numero).padStart(3, '0')}
        </span>
        <h1 className="font-display text-title-screen text-ink">
          {fraseDoPedido(pedido.tipo, pedido.situacao)}
        </h1>
        {!cancelado && pedido.situacao !== 'concluido' && (
          <span className="flex flex-col pt-2">
            <span className="text-caption text-ink-muted">
              {pedido.tipo === 'delivery' ? 'Entrega em' : 'Pronto em'}
            </span>
            <span className="text-[2.5rem] leading-none font-black tracking-[-0.04em] text-ink tabular-nums">
              {pedido.tempo.min}–{pedido.tempo.max} min
            </span>
          </span>
        )}
      </header>

      {cancelado ? (
        <Alert>
          {pedido.motivo
            ? `Motivo: ${pedido.motivo}`
            : 'A loja não conseguiu aceitar o pedido agora.'}
        </Alert>
      ) : (
        <ol
          aria-label="Andamento do pedido"
          className="grid gap-1 rounded-lg bg-surface px-2 py-4"
          style={{
            gridTemplateColumns: `repeat(${etapasDoPedido(pedido.tipo, pedido.situacao).length}, minmax(0, 1fr))`,
          }}
        >
          {etapasDoPedido(pedido.tipo, pedido.situacao).map((e, i, todas) => {
            const curto = ETAPA_CURTA[e.rotulo] ?? { texto: e.rotulo, icone: 'check' as const };
            return (
              <li key={e.rotulo} className="relative flex flex-col items-center gap-2 text-center">
                {i > 0 && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute top-[1.125rem] right-1/2 h-0.5 w-full -translate-y-1/2',
                      e.estado === 'futuro' ? 'bg-line' : 'bg-brand',
                    )}
                  />
                )}
                <span
                  className={cn(
                    'relative flex size-9 items-center justify-center rounded-pill',
                    e.estado === 'futuro'
                      ? 'bg-surface-strong text-ink-muted'
                      : 'bg-brand text-brand-ink',
                    e.estado === 'atual' && 'ring-4 ring-brand-soft',
                  )}
                >
                  <Icon name={curto.icone} size={18} />
                </span>
                <span
                  className={cn(
                    'text-micro leading-tight',
                    e.estado === 'futuro' ? 'text-ink-muted' : 'font-bold text-ink',
                  )}
                >
                  {curto.texto}
                </span>
                <span className="sr-only">
                  {e.rotulo}
                  {e.estado === 'atual' ? ' (agora)' : e.estado === 'feito' ? ' (feito)' : ''}
                  {i === todas.length - 1 ? '' : ','}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {pedido.codigo_entrega && !cancelado && pedido.situacao !== 'concluido' && (
        <div className="flex flex-col gap-1 rounded-lg bg-sun p-5">
          <span className="text-label text-sun-ink">Código de entrega</span>
          <span className="font-display text-display tracking-widest text-sun-ink">
            {pedido.codigo_entrega}
          </span>
          <span className="text-caption text-sun-ink">
            Diga este código ao entregador quando ele chegar. São os 4 últimos números do seu
            celular.
          </span>
        </div>
      )}

      <Panel title="Seu pedido">
        <ul className="flex flex-col gap-1">
          {pedido.itens.map((i, n) => (
            <li key={n} className="flex justify-between gap-3 text-body text-ink">
              <span>
                {i.quantidade}× {i.nome}
                {i.tamanho ? ` · ${i.tamanho}` : ''}
                {i.adicionais.length ? ` · ${i.adicionais.join(', ')}` : ''}
              </span>
              <span className="text-ink-muted tabular-nums">{formatarPreco(i.total)}</span>
            </li>
          ))}
        </ul>
        <dl className="flex flex-col gap-1 border-t border-line pt-3 text-body">
          {pedido.tipo === 'delivery' && (
            <div className="flex justify-between text-ink-muted">
              <dt>Entrega</dt>
              <dd className="tabular-nums">
                {pedido.taxa_entrega ? formatarPreco(pedido.taxa_entrega) : 'Grátis'}
              </dd>
            </div>
          )}
          <div className="flex justify-between text-body-strong text-ink">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatarPreco(pedido.total)}</dd>
          </div>
        </dl>
        <p className="text-caption text-ink-muted">
          Pagamento na {pedido.tipo === 'delivery' ? 'entrega' : 'retirada'}:{' '}
          {PAGAMENTO[pedido.pagamento.metodo ?? ''] ?? '—'}
          {pedido.pagamento.troco_para
            ? ` · troco para ${formatarPreco(pedido.pagamento.troco_para)}`
            : ''}
        </p>
        {pedido.endereco && (
          <p className="text-caption text-ink-muted">
            Entregar em {pedido.endereco.rua}, {pedido.endereco.numero}
            {pedido.endereco.complemento ? ` (${pedido.endereco.complemento})` : ''} ·{' '}
            {pedido.endereco.bairro}
          </p>
        )}
      </Panel>

      {pedido.loja.telefone && (
        <a
          href={whatsapp(pedido.loja.telefone, `Oi! Sobre o meu pedido #${pedido.numero}`)}
          target="_blank"
          rel="noreferrer"
        >
          <Button variant="secondary" className="w-full">
            Falar com a loja no WhatsApp
          </Button>
        </a>
      )}
      <Button variant="ghost" onClick={() => navegar(`${voltar === '/' ? '' : voltar}/conta`)}>
        Meus pedidos e endereços
      </Button>
      <p className="text-center text-caption text-ink-muted">
        A página atualiza sozinha. O pedido também fica em Minha conta.
      </p>
    </main>
  );
}
