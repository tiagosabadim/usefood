import {
  DADOS_INICIAIS,
  formatarPreco,
  identificacaoPara,
  lerCep,
  lerPreco,
  precoParaCampo,
  rotuloDoTipo,
  type Atendimento,
  type DadosDoPedido,
  type MetodoPagamento,
  type TipoPedido,
} from '@usefood/core';
import type { AppSupabaseClient } from '@usefood/db';
import { Button, ChoiceGrid, SegmentedControl, TextField, type Option } from '@usefood/ui';
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
  entrega,
}: {
  dados: DadosDoPedido;
  onChange: (dados: DadosDoPedido) => void;
  atendimento: Atendimento;
  tipos?: TipoPedido[];
  /** Para calcular a taxa pela configuração da loja (bairro ou distância). */
  entrega?: { supabase: AppSupabaseClient; lojaId: string; subtotalCentavos: number };
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
      {dados.tipo === 'delivery' && (
        <CamposDeEntrega dados={dados} onChange={onChange} entrega={entrega} />
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

/** Celular, endereço com CEP e taxa de entrega (calculada pela loja quando dá; a equipe pode mudar). */
function CamposDeEntrega({
  dados,
  onChange,
  entrega,
}: {
  dados: DadosDoPedido;
  onChange: (dados: DadosDoPedido) => void;
  entrega?: { supabase: AppSupabaseClient; lojaId: string; subtotalCentavos: number } | undefined;
}) {
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [sugerida, setSugerida] = useState<number | null>(null);
  const e = dados.endereco;
  const mudar = (campo: keyof DadosDoPedido['endereco'], valor: string) =>
    onChange({ ...dados, endereco: { ...e, [campo]: valor } });

  // Taxa pela configuração da loja, quando o bairro (ou a cidade) muda
  useEffect(() => {
    if (!entrega || !e.bairro.trim()) return;
    const t = setTimeout(() => {
      void entrega.supabase
        .rpc('calcular_entrega', {
          p_restaurant_id: entrega.lojaId,
          p_bairro: e.bairro.trim(),
          p_cidade: e.cidade.trim() || null,
          p_latitude: null,
          p_longitude: null,
          p_subtotal_cents: entrega.subtotalCentavos,
        })
        .then(({ data }) => {
          const r = data?.[0];
          setSugerida(r?.atende ? r.taxa_cents : null);
          setAviso(r && !r.atende ? (r.motivo ?? '') : '');
        });
    }, 500);
    return () => clearTimeout(t);
  }, [entrega, e.bairro, e.cidade]);

  async function buscarCep() {
    const cep = lerCep(e.cep);
    if (!cep) return setAviso('O CEP tem 8 números.');
    setBuscando(true);
    try {
      const j = (await (await fetch(`https://viacep.com.br/ws/${cep}/json/`)).json()) as {
        erro?: boolean;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
      };
      if (j.erro) setAviso('CEP não encontrado. Preencha o endereço.');
      else {
        setAviso('');
        onChange({
          ...dados,
          endereco: {
            ...e,
            rua: j.logradouro || e.rua,
            bairro: j.bairro || e.bairro,
            cidade: j.localidade || e.cidade,
          },
        });
      }
    } catch {
      setAviso('Não foi possível buscar o CEP agora.');
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <TextField
        label="Celular do cliente"
        hint="Para o entregador ligar e para o código de entrega."
        inputMode="tel"
        value={dados.celular}
        onChange={(ev) => onChange({ ...dados, celular: ev.target.value })}
      />
      <div className="flex items-end gap-2">
        <TextField
          label="CEP"
          inputMode="numeric"
          className="w-36"
          maxLength={9}
          value={e.cep}
          onChange={(ev) => mudar('cep', ev.target.value)}
        />
        <Button variant="secondary" loading={buscando} onClick={() => void buscarCep()}>
          Buscar
        </Button>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-2">
        <TextField label="Rua" value={e.rua} onChange={(ev) => mudar('rua', ev.target.value)} />
        <TextField
          label="Número"
          value={e.numero}
          onChange={(ev) => mudar('numero', ev.target.value)}
        />
      </div>
      <TextField
        label="Complemento (opcional)"
        value={e.complemento}
        onChange={(ev) => mudar('complemento', ev.target.value)}
      />
      <div className="grid grid-cols-2 gap-2">
        <TextField
          label="Bairro"
          value={e.bairro}
          onChange={(ev) => mudar('bairro', ev.target.value)}
        />
        <TextField
          label="Cidade"
          value={e.cidade}
          onChange={(ev) => mudar('cidade', ev.target.value)}
        />
      </div>
      <TextField
        label="Referência (opcional)"
        placeholder="Ex.: portão azul, ao lado da padaria"
        value={e.referencia}
        onChange={(ev) => mudar('referencia', ev.target.value)}
      />
      <div className="flex items-end gap-2">
        <TextField
          label="Taxa de entrega"
          inputMode="decimal"
          placeholder="Grátis"
          className="w-36"
          value={dados.taxaEntrega}
          onChange={(ev) => onChange({ ...dados, taxaEntrega: ev.target.value })}
        />
        {sugerida !== null && lerPreco(dados.taxaEntrega || '0') !== sugerida && (
          <Button
            variant="ghost"
            onClick={() =>
              onChange({ ...dados, taxaEntrega: sugerida ? precoParaCampo(sugerida) : '' })
            }
          >
            Usar {sugerida ? formatarPreco(sugerida) : 'grátis'} (da loja)
          </Button>
        )}
      </div>
      {aviso && <p className="text-caption text-ink-muted">{aviso}</p>}
    </div>
  );
}
