import {
  dividirIgual,
  formatarPreco,
  lerPreco,
  precoParaCampo,
  rotuloDaConta,
  sugestoesDeNotas,
  taxaPadrao,
  taxaServicoCentavos,
} from '@usefood/core';
import type { AppSupabaseClient, Enums, Tables } from '@usefood/db';
import {
  Alert,
  Button,
  ChoiceGrid,
  SegmentedControl,
  Switch,
  TextField,
  type Option,
} from '@usefood/ui';
import { useState } from 'react';

export type Conta = Pick<
  Tables<'tabs'>,
  | 'id'
  | 'type'
  | 'identifier_type'
  | 'identifier'
  | 'subtotal_cents'
  | 'service_fee_cents'
  | 'total_cents'
  | 'paid_cents'
  | 'expected_method'
  | 'change_for_cents'
>;
type Metodo = Enums<'payment_method'>;
export interface PagamentoFeito {
  metodo: Metodo;
  valorCentavos: number;
  trocoCentavos: number;
}

export const METODOS: Option<Metodo>[] = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'Pix' },
  { value: 'credito', label: 'Crédito' },
  { value: 'debito', label: 'Débito' },
];
export const rotuloDoMetodo = (m: Metodo) => METODOS.find((x) => x.value === m)?.label ?? m;
const DIVISOES: Option<'1' | '2' | '3' | '4'>[] = [
  { value: '1', label: 'Inteira' },
  { value: '2', label: '÷ 2' },
  { value: '3', label: '÷ 3' },
  { value: '4', label: '÷ 4' },
];
const ERROS_CONHECIDOS = new Set(['P0001', 'P0002', '22023', '42501']);
const mensagem = (e: { code?: string; message?: string }) =>
  e.code && ERROS_CONHECIDOS.has(e.code) && e.message
    ? e.message
    : 'Não deu certo agora. Confira a internet e tente de novo.';

/** Cobra uma conta: taxa de 10% opcional, inteira ou dividida, várias formas de pagamento. */
export function Cobranca({
  supabase,
  conta,
  onPaga,
  onVoltar,
}: {
  supabase: AppSupabaseClient;
  conta: Conta;
  onPaga: (pagamentos: PagamentoFeito[]) => void;
  onVoltar: () => void;
}) {
  const jaComecou = conta.paid_cents > 0;
  const [taxa, setTaxa] = useState(
    jaComecou ? conta.service_fee_cents > 0 : taxaPadrao(conta.type),
  );
  const [totalDoBanco, setTotalDoBanco] = useState<number | null>(
    jaComecou ? conta.total_cents : null,
  );
  const [pagoAntes] = useState(conta.paid_cents);
  const [pagamentos, setPagamentos] = useState<PagamentoFeito[]>([]);
  const [dividirPor, setDividirPor] = useState(1);
  const [parteDigitada, setParteDigitada] = useState<string | null>(null);
  const [metodo, setMetodo] = useState<Metodo | null>(conta.expected_method);
  const [recebido, setRecebido] = useState(
    conta.change_for_cents ? precoParaCampo(conta.change_for_cents) : '',
  );
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const taxaCentavos = taxa ? taxaServicoCentavos(conta.subtotal_cents) : 0;
  // Antes do primeiro pagamento, o total depende do interruptor da taxa; depois, vale o do banco.
  const total = totalDoBanco ?? conta.subtotal_cents + taxaCentavos;
  const pago = pagoAntes + pagamentos.reduce((s, p) => s + p.valorCentavos, 0);
  const falta = Math.max(0, total - pago);
  const podeMudarTaxa = pago === 0;
  const pessoasRestantes = Math.max(1, dividirPor - pagamentos.length);
  const parteSugerida = dividirIgual(falta, pessoasRestantes)[0] ?? falta;
  const parte = parteDigitada === null ? parteSugerida : lerPreco(parteDigitada);
  const parteValida = parte !== null && parte > 0 && parte <= falta;
  const recebidoCentavos = lerPreco(recebido);
  const troco =
    metodo === 'dinheiro' && recebidoCentavos !== null && parte !== null
      ? recebidoCentavos - parte
      : 0;
  const podeConfirmar =
    metodo !== null &&
    parteValida &&
    (metodo !== 'dinheiro' ||
      (recebidoCentavos !== null && parte !== null && recebidoCentavos >= parte));

  async function receber() {
    if (!metodo || parte === null) return;
    setErro('');
    setEnviando(true);
    const { data, error } = await supabase.rpc('receber_conta', {
      p_conta: conta.id,
      p_metodo: metodo,
      p_valor_cents: parte,
      p_recebido_cents: metodo === 'dinheiro' ? recebidoCentavos : null,
      p_taxa_servico: podeMudarTaxa ? taxa : null,
    });
    setEnviando(false);
    const r = data?.[0];
    if (error || !r) {
      setErro(error ? mensagem(error) : 'Não foi possível registrar o pagamento.');
      return;
    }
    const feito = { metodo, valorCentavos: r.pago_cents - pago, trocoCentavos: r.troco_cents };
    const todos = [...pagamentos, feito];
    setPagamentos(todos);
    setTotalDoBanco(r.total_cents);
    setMetodo(null);
    setRecebido('');
    setParteDigitada(null);
    if (r.falta_cents <= 0) onPaga(todos);
  }

  return (
    <div className="flex flex-1 flex-col gap-5 p-6 lg:overflow-y-auto">
      <div className="flex flex-col gap-1">
        <span className="text-caption text-ink-muted">
          {rotuloDaConta(conta.identifier_type, conta.identifier)}
          {pago > 0 ? ` · falta pagar de ${formatarPreco(total)}` : ''}
        </span>
        <span className="font-display text-display text-ink tabular-nums">
          {formatarPreco(falta)}
        </span>
      </div>

      <div className="flex flex-col gap-2 rounded-md bg-surface-strong p-4 text-body">
        <div className="flex justify-between text-ink-muted">
          <span>Consumo</span>
          <span className="tabular-nums">{formatarPreco(conta.subtotal_cents)}</span>
        </div>
        <Switch
          checked={taxa}
          onChange={(v) => {
            setTaxa(v);
            setParteDigitada(null);
          }}
          disabled={!podeMudarTaxa}
          showLabel
          label={`Taxa de serviço (10%) · ${formatarPreco(taxaServicoCentavos(conta.subtotal_cents))}`}
        />
        {!podeMudarTaxa && (
          <p className="text-caption text-ink-muted">
            A taxa não muda depois do primeiro pagamento.
          </p>
        )}
      </div>

      {(pagamentos.length > 0 || pagoAntes > 0) && (
        <ul className="flex flex-col gap-1 text-body text-ink-muted">
          {pagoAntes > 0 && (
            <li className="flex justify-between">
              <span>Pago antes</span>
              <span className="tabular-nums">{formatarPreco(pagoAntes)}</span>
            </li>
          )}
          {pagamentos.map((p, i) => (
            <li key={i} className="flex justify-between">
              <span>
                {rotuloDoMetodo(p.metodo)}
                {p.trocoCentavos > 0 && ` · troco ${formatarPreco(p.trocoCentavos)}`}
              </span>
              <span className="tabular-nums">{formatarPreco(p.valorCentavos)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-label text-ink">Dividir a conta</span>
        <SegmentedControl
          label="Dividir a conta"
          options={DIVISOES}
          value={String(dividirPor) as '1' | '2' | '3' | '4'}
          onChange={(v) => {
            setDividirPor(Number(v));
            setParteDigitada(null);
          }}
        />
      </div>
      {(dividirPor > 1 || pago > 0) && (
        <TextField
          label="Valor desta parte"
          inputMode="decimal"
          value={parteDigitada ?? precoParaCampo(parteSugerida)}
          onChange={(e) => setParteDigitada(e.target.value)}
          error={!parteValida ? `Digite um valor de até ${formatarPreco(falta)}.` : undefined}
          hint={dividirPor > 1 ? `Parte ${pagamentos.length + 1} de ${dividirPor}` : undefined}
        />
      )}

      <ChoiceGrid
        label="Forma de pagamento"
        options={METODOS}
        value={metodo}
        onChange={(m) => {
          setMetodo(m);
          setErro('');
        }}
      />
      {metodo === 'dinheiro' && parte !== null && (
        <div className="flex flex-col gap-3">
          <TextField
            label="Valor recebido"
            inputMode="decimal"
            placeholder="0,00"
            value={recebido}
            onChange={(e) => setRecebido(e.target.value)}
            error={
              recebidoCentavos !== null && recebidoCentavos < parte
                ? 'Valor menor que a parte.'
                : undefined
            }
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setRecebido(precoParaCampo(parte))}>
              Valor exato
            </Button>
            {sugestoesDeNotas(parte).map((nota) => (
              <Button
                key={nota}
                variant="secondary"
                onClick={() => setRecebido(precoParaCampo(nota))}
              >
                {formatarPreco(nota)}
              </Button>
            ))}
          </div>
          {troco > 0 && (
            <p className="text-body-strong text-ink">
              Troco: <span className="tabular-nums">{formatarPreco(troco)}</span>
            </p>
          )}
        </div>
      )}
      <Alert>{erro}</Alert>
      <div className="mt-auto flex flex-col gap-2">
        <Button
          className="h-target-pdv"
          disabled={!podeConfirmar}
          loading={enviando}
          onClick={() => void receber()}
        >
          {parte !== null && parte < falta
            ? `Receber ${formatarPreco(parte)}`
            : `Receber ${formatarPreco(falta)}`}
        </Button>
        {pagamentos.length === 0 && (
          <Button variant="ghost" onClick={onVoltar}>
            Voltar
          </Button>
        )}
      </div>
    </div>
  );
}

/** Tela final de uma conta paga, com o troco em destaque. */
export function ContaPaga({
  conta,
  pagamentos,
  onNovo,
  onImprimirDeNovo,
}: {
  conta: Conta;
  pagamentos: PagamentoFeito[];
  onNovo: () => void;
  onImprimirDeNovo?: (() => Promise<boolean>) | undefined;
}) {
  const [reimpresso, setReimpresso] = useState<'nao' | 'enviando' | 'sim'>('nao');
  const troco = pagamentos.at(-1)?.trocoCentavos ?? 0;
  return (
    <div className="flex flex-1 flex-col justify-center gap-6 p-6">
      <div className="flex flex-col gap-2">
        <span className="text-caption text-ink-muted">Conta paga</span>
        <span className="font-display text-display text-ink">
          {rotuloDaConta(conta.identifier_type, conta.identifier)}
        </span>
      </div>
      <ul className="flex flex-col gap-1 text-body text-ink-muted">
        {pagamentos.map((p, i) => (
          <li key={i} className="flex justify-between">
            <span>{rotuloDoMetodo(p.metodo)}</span>
            <span className="tabular-nums">{formatarPreco(p.valorCentavos)}</span>
          </li>
        ))}
      </ul>
      {troco > 0 && (
        <div className="rounded-lg bg-sun p-5">
          <span className="text-label text-sun-ink">Troco</span>
          <p className="font-display text-display text-sun-ink tabular-nums">
            {formatarPreco(troco)}
          </p>
        </div>
      )}
      <Button className="h-target-pdv" onClick={onNovo}>
        Novo pedido
      </Button>
      {onImprimirDeNovo && (
        <Button
          variant="ghost"
          loading={reimpresso === 'enviando'}
          disabled={reimpresso === 'sim'}
          onClick={() => {
            setReimpresso('enviando');
            void onImprimirDeNovo().then((ok) => setReimpresso(ok ? 'sim' : 'nao'));
          }}
        >
          {reimpresso === 'sim' ? 'Enviado para a cozinha de novo' : 'Imprimir de novo'}
        </Button>
      )}
    </div>
  );
}
