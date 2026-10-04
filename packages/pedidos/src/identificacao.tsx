import {
  DADOS_INICIAIS,
  identificacaoPara,
  lerPreco,
  rotuloDoTipo,
  type Atendimento,
  type DadosDoPedido,
  type MetodoPagamento,
  type TipoPedido,
} from '@usefood/core';
import type { AppSupabaseClient } from '@usefood/db';
import { ChoiceGrid, SegmentedControl, TextField, type Option } from '@usefood/ui';
import { useEffect, useState } from 'react';

const ATENDIMENTO_PADRAO: Atendimento = { chamarPor: 'senha', balcao: 'cliente_busca' };
const TODOS: TipoPedido[] = ['balcao', 'mesa', 'retirada', 'delivery'];
const PAGAMENTOS: Option<MetodoPagamento>[] = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'Pix' },
  { value: 'credito', label: 'Crédito' },
  { value: 'debito', label: 'Débito' },
];

/** Jeito de atender da loja (Configurações): chamar por senha ou nome, balcão com garçom ou não. */
export function useAtendimento(supabase: AppSupabaseClient, lojaId: string): Atendimento {
  const [atendimento, setAtendimento] = useState<Atendimento>(ATENDIMENTO_PADRAO);
  useEffect(() => {
    let ativo = true;
    void supabase
      .from('restaurants')
      .select('call_by, counter_dine_in')
      .eq('id', lojaId)
      .single()
      .then(({ data }) => {
        if (ativo && data)
          setAtendimento({ chamarPor: data.call_by, balcao: data.counter_dine_in });
      });
    return () => {
      ativo = false;
    };
  }, [supabase, lojaId]);
  return atendimento;
}

/**
 * Tipo do pedido (Comer aqui, Mesa, Para viagem, Delivery) e o que identificar em cada um,
 * seguindo a configuração da loja. É o mesmo no PDV e na comanda do garçom.
 */
export function TipoEIdentificacao({
  dados,
  onChange,
  atendimento,
  tipos = TODOS,
}: {
  dados: DadosDoPedido;
  onChange: (dados: DadosDoPedido) => void;
  atendimento: Atendimento;
  tipos?: TipoPedido[];
}) {
  const ident = identificacaoPara(dados.tipo, atendimento);
  const trocoInvalido =
    dados.previsto === 'dinheiro' &&
    dados.trocoPara.trim() !== '' &&
    lerPreco(dados.trocoPara) === null;

  return (
    <div className="flex flex-col gap-3">
      {tipos.length > 1 && (
        <SegmentedControl
          label="Tipo do pedido"
          options={tipos.map((t) => ({ value: t, label: rotuloDoTipo(t) }))}
          value={dados.tipo}
          onChange={(tipo) => onChange({ ...DADOS_INICIAIS, tipo })}
        />
      )}
      {ident.campo ? (
        <TextField
          label={ident.campo.rotulo}
          inputMode={ident.campo.numerico ? 'numeric' : 'text'}
          maxLength={40}
          value={dados.identificador}
          onChange={(e) => onChange({ ...dados, identificador: e.target.value })}
        />
      ) : (
        <p className="text-caption text-ink-muted">
          A senha sai sozinha e é chamada quando o pedido ficar pronto.
        </p>
      )}
      {(dados.tipo === 'delivery' || dados.tipo === 'retirada') && (
        <div className="flex flex-col gap-2">
          <span className="text-label text-ink">Como vai pagar</span>
          <ChoiceGrid
            label="Como o cliente vai pagar"
            columns={4}
            options={PAGAMENTOS}
            value={dados.previsto}
            onChange={(previsto) => onChange({ ...dados, previsto, trocoPara: '' })}
          />
          {dados.previsto === 'dinheiro' && (
            <TextField
              label="Troco para (opcional)"
              inputMode="decimal"
              placeholder="Ex.: 100,00"
              value={dados.trocoPara}
              onChange={(e) => onChange({ ...dados, trocoPara: e.target.value })}
              error={trocoInvalido ? 'Digite um valor, por exemplo 100,00.' : undefined}
            />
          )}
        </div>
      )}
    </div>
  );
}
