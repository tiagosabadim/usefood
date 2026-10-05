import { useAppContext } from '@usefood/app';
import { etapasDoPedido, formatarPreco, fraseDoPedido, type SituacaoDoPedido } from '@usefood/core';
import { Alert, Button, cn, Panel } from '@usefood/ui';
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
          <span className="text-body text-ink-muted">
            Tempo estimado: {pedido.tempo.min} a {pedido.tempo.max} min
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
        <ol className="flex flex-col gap-3" aria-label="Andamento do pedido">
          {etapasDoPedido(pedido.tipo, pedido.situacao).map((e) => (
            <li key={e.rotulo} className="flex items-center gap-3">
              <span
                className={cn(
                  'size-4 shrink-0 rounded-pill border-2',
                  e.estado === 'feito' && 'border-success bg-success',
                  e.estado === 'atual' && 'border-brand bg-brand',
                  e.estado === 'futuro' && 'border-line-strong',
                )}
              />
              <span
                className={cn(
                  'text-body',
                  e.estado === 'futuro' ? 'text-ink-muted' : 'text-body-strong text-ink',
                )}
              >
                {e.rotulo}
                {e.estado === 'atual' && <span className="sr-only"> (agora)</span>}
              </span>
            </li>
          ))}
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
