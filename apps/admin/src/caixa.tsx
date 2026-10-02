import { formatarPreco, horaCurta, lerPreco, resultadoDoFechamento } from '@usefood/core';
import type { AppSupabaseClient, Database, Enums, Tables } from '@usefood/db';
import { Alert, Button, Panel, SegmentedControl, Sheet, StatusPill, TextField } from '@usefood/ui';
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Tela, Titulo } from './tela';

type Sessao = Pick<Tables<'cash_sessions'>, 'id' | 'register_name' | 'opened_at' | 'opening_cents'>;
type Resumo = Database['public']['Functions']['resumo_do_caixa']['Returns'][number];
type Fechamento = Database['public']['Functions']['fechar_caixa']['Returns'][number];
type Movimento = Enums<'cash_movement_type'>;

const ERROS_CONHECIDOS = new Set(['P0001', '22023', '42501']);
const mensagem = (e: { code?: string; message?: string }) =>
  e.code && ERROS_CONHECIDOS.has(e.code) && e.message
    ? e.message
    : 'Não deu certo agora. Tente de novo.';

/**
 * Envolve o PDV: sem caixa aberto, pede o fundo de troco; com caixa aberto, mostra o PDV
 * com o botão do caixa; depois do fechamento, mostra o resultado.
 */
export function PdvComCaixa({
  supabase,
  loja,
  onVoltar,
  children,
}: {
  supabase: AppSupabaseClient;
  loja: { id: string; name: string };
  onVoltar: () => void;
  children: (cabecalhoDoCaixa: ReactNode) => ReactNode;
}) {
  const [sessao, setSessao] = useState<Sessao | null | undefined>(undefined);
  const [painelAberto, setPainelAberto] = useState(false);
  const [fechado, setFechado] = useState<{ fechamento: Fechamento; resumo: Resumo | null } | null>(
    null,
  );
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let ativo = true;
    void supabase
      .from('cash_sessions')
      .select('id, register_name, opened_at, opening_cents')
      .eq('restaurant_id', loja.id)
      .eq('status', 'aberto')
      .order('opened_at')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (ativo) setSessao(data ?? null);
      });
    return () => {
      ativo = false;
    };
  }, [supabase, loja.id, versao]);

  if (fechado) {
    return <CaixaFechado {...fechado} onVoltar={onVoltar} />;
  }
  if (sessao === undefined) {
    return (
      <Tela>
        <p className="text-body text-ink-muted">Conferindo o caixa…</p>
      </Tela>
    );
  }
  if (sessao === null) {
    return (
      <AbrirCaixa
        supabase={supabase}
        loja={loja}
        onAberto={() => setVersao((v) => v + 1)}
        onVoltar={onVoltar}
      />
    );
  }

  const cabecalho = (
    <div className="flex items-center gap-3">
      <span className="text-caption text-ink-muted">
        {sessao.register_name} · aberto às {horaCurta(sessao.opened_at)}
      </span>
      <Button variant="secondary" onClick={() => setPainelAberto(true)}>
        Caixa
      </Button>
    </div>
  );

  return (
    <>
      {children(cabecalho)}
      {painelAberto && (
        <PainelDoCaixa
          supabase={supabase}
          sessao={sessao}
          onFechar={() => setPainelAberto(false)}
          onCaixaFechado={(resultado) => {
            setPainelAberto(false);
            setFechado(resultado);
          }}
        />
      )}
    </>
  );
}

function AbrirCaixa({
  supabase,
  loja,
  onAberto,
  onVoltar,
}: {
  supabase: AppSupabaseClient;
  loja: { id: string; name: string };
  onAberto: () => void;
  onVoltar: () => void;
}) {
  const [fundo, setFundo] = useState('');
  const [erro, setErro] = useState('');
  const [abrindo, setAbrindo] = useState(false);
  const fundoCentavos = fundo.trim() === '' ? 0 : lerPreco(fundo);

  async function abrir(evento: FormEvent) {
    evento.preventDefault();
    if (fundoCentavos === null) return;
    setErro('');
    setAbrindo(true);
    const { error } = await supabase.rpc('abrir_caixa', {
      p_restaurant_id: loja.id,
      p_fundo_cents: fundoCentavos,
    });
    setAbrindo(false);
    if (error) setErro(mensagem(error));
    else onAberto();
  }

  return (
    <Tela>
      <Button variant="ghost" className="self-start px-0" onClick={onVoltar}>
        ← {loja.name}
      </Button>
      <Titulo
        titulo="Abrir o caixa"
        texto="Conte o dinheiro que fica na gaveta para troco. Sem caixa aberto, o PDV não recebe pagamentos."
      />
      <form className="flex flex-col gap-5" onSubmit={abrir}>
        <TextField
          label="Fundo de troco"
          inputMode="decimal"
          placeholder="0,00"
          autoFocus
          value={fundo}
          onChange={(e) => setFundo(e.target.value)}
          error={fundoCentavos === null ? 'Digite um valor, por exemplo 100,00.' : undefined}
          hint={fundoCentavos !== null ? formatarPreco(fundoCentavos) : undefined}
        />
        <Alert>{erro}</Alert>
        <Button
          type="submit"
          className="h-target-pdv"
          loading={abrindo}
          disabled={fundoCentavos === null}
        >
          Abrir o caixa
        </Button>
      </form>
    </Tela>
  );
}

function LinhasDoResumo({ resumo }: { resumo: Resumo }) {
  const linhas: [string, number][] = [
    ['Dinheiro', resumo.dinheiro_cents],
    ['Pix', resumo.pix_cents],
    ['Crédito', resumo.credito_cents],
    ['Débito', resumo.debito_cents],
    ['Outros', resumo.outros_cents],
  ];
  return (
    <dl className="flex flex-col gap-1 text-body">
      {linhas
        .filter(([, valor], i) => valor > 0 || i < 4)
        .map(([rotulo, valor]) => (
          <div key={rotulo} className="flex justify-between text-ink-muted">
            <dt>{rotulo}</dt>
            <dd className="tabular-nums">{formatarPreco(valor)}</dd>
          </div>
        ))}
      <div className="flex justify-between border-t border-line pt-2 text-body-strong text-ink">
        <dt>Vendido · {resumo.pedidos === 1 ? '1 pedido' : `${resumo.pedidos} pedidos`}</dt>
        <dd className="tabular-nums">{formatarPreco(resumo.vendido_cents)}</dd>
      </div>
    </dl>
  );
}

function PainelDoCaixa({
  supabase,
  sessao,
  onFechar,
  onCaixaFechado,
}: {
  supabase: AppSupabaseClient;
  sessao: Sessao;
  onFechar: () => void;
  onCaixaFechado: (resultado: { fechamento: Fechamento; resumo: Resumo | null }) => void;
}) {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [tipo, setTipo] = useState<Movimento>('sangria');
  const [valor, setValor] = useState('');
  const [motivo, setMotivo] = useState('');
  const [fechando, setFechando] = useState(false);
  const [contado, setContado] = useState('');
  const [observacao, setObservacao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.rpc('resumo_do_caixa', { p_sessao: sessao.id });
    if (error) setErro('Não conseguimos carregar o resumo do caixa.');
    else setResumo(data[0] ?? null);
  }, [supabase, sessao.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
  }, [carregar]);

  const valorCentavos = lerPreco(valor);
  const contadoCentavos = lerPreco(contado);

  async function movimentar(evento: FormEvent) {
    evento.preventDefault();
    if (valorCentavos === null || valorCentavos <= 0) return;
    setErro('');
    setAviso('');
    setEnviando(true);
    const { error } = await supabase.rpc('movimentar_caixa', {
      p_sessao: sessao.id,
      p_tipo: tipo,
      p_valor_cents: valorCentavos,
      p_motivo: motivo.trim() || null,
    });
    setEnviando(false);
    if (error) {
      setErro(mensagem(error));
      return;
    }
    setAviso(
      `${tipo === 'sangria' ? 'Sangria' : 'Suprimento'} de ${formatarPreco(valorCentavos)} registrado.`,
    );
    setValor('');
    setMotivo('');
    void carregar();
  }

  async function fechar() {
    if (contadoCentavos === null) return;
    setErro('');
    setEnviando(true);
    const { data, error } = await supabase.rpc('fechar_caixa', {
      p_sessao: sessao.id,
      p_contado_cents: contadoCentavos,
      p_observacao: observacao.trim() || null,
    });
    setEnviando(false);
    const fechamento = data?.[0];
    if (error || !fechamento) {
      setErro(error ? mensagem(error) : 'Não foi possível fechar o caixa.');
      return;
    }
    onCaixaFechado({ fechamento, resumo });
  }

  return (
    <Sheet
      open
      onClose={onFechar}
      title={`${sessao.register_name} · aberto às ${horaCurta(sessao.opened_at)}`}
      footer={
        fechando ? (
          <div className="flex gap-3">
            <Button
              loading={enviando}
              disabled={contadoCentavos === null}
              onClick={() => void fechar()}
            >
              Confirmar fechamento
            </Button>
            <Button variant="ghost" onClick={() => setFechando(false)}>
              Voltar
            </Button>
          </div>
        ) : (
          <Button variant="secondary" onClick={() => setFechando(true)}>
            Fechar o caixa
          </Button>
        )
      }
    >
      <Alert>{erro}</Alert>
      <Alert tone="sucesso">{aviso}</Alert>

      {resumo && !fechando && (
        <div className="flex flex-col gap-1 rounded-lg bg-surface-strong p-5">
          <span className="text-label text-ink-muted">Dinheiro que deve estar na gaveta</span>
          <span className="font-display text-display text-ink tabular-nums">
            {formatarPreco(resumo.esperado_cents)}
          </span>
          <span className="text-caption text-ink-muted">
            Fundo {formatarPreco(resumo.fundo_cents)} + vendas em dinheiro{' '}
            {formatarPreco(resumo.dinheiro_cents)}
            {resumo.suprimentos_cents > 0 &&
              ` + suprimentos ${formatarPreco(resumo.suprimentos_cents)}`}
            {resumo.sangrias_cents > 0 && ` − sangrias ${formatarPreco(resumo.sangrias_cents)}`}
          </span>
        </div>
      )}

      {fechando ? (
        <section className="flex flex-col gap-4">
          <p className="text-body text-ink">
            Conte o dinheiro da gaveta e digite o total. O valor esperado fica escondido até você
            confirmar, para a conferência valer.
          </p>
          <TextField
            label="Dinheiro contado"
            inputMode="decimal"
            placeholder="0,00"
            autoFocus
            value={contado}
            onChange={(e) => setContado(e.target.value)}
            error={
              contado && contadoCentavos === null
                ? 'Digite um valor, por exemplo 117,00.'
                : undefined
            }
          />
          <TextField
            label="Observação (opcional)"
            maxLength={300}
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
          />
        </section>
      ) : (
        <>
          {resumo && (
            <Panel title="Vendas do turno">
              <LinhasDoResumo resumo={resumo} />
            </Panel>
          )}
          <Panel title="Movimentar a gaveta">
            <form className="flex flex-col gap-4" onSubmit={movimentar}>
              <SegmentedControl
                label="Tipo de movimento"
                className="self-start"
                options={[
                  { value: 'sangria', label: 'Sangria (tirar)' },
                  { value: 'suprimento', label: 'Suprimento (pôr)' },
                ]}
                value={tipo}
                onChange={setTipo}
              />
              <div className="grid gap-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
                <TextField
                  label="Valor"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                />
                <TextField
                  label="Motivo"
                  placeholder={tipo === 'sangria' ? 'Ex.: depósito no banco' : 'Ex.: troco extra'}
                  maxLength={120}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                variant="secondary"
                className="self-start"
                loading={enviando}
                disabled={valorCentavos === null || valorCentavos <= 0}
              >
                Registrar {tipo === 'sangria' ? 'sangria' : 'suprimento'}
              </Button>
            </form>
          </Panel>
        </>
      )}
    </Sheet>
  );
}

function CaixaFechado({
  fechamento,
  resumo,
  onVoltar,
}: {
  fechamento: Fechamento;
  resumo: Resumo | null;
  onVoltar: () => void;
}) {
  const resultado = resultadoDoFechamento(fechamento.diferenca_cents);
  const tom =
    resultado.tom === 'sucesso' ? 'sucesso' : resultado.tom === 'erro' ? 'erro' : 'destaque';
  return (
    <Tela>
      <Titulo
        titulo="Caixa fechado"
        texto="Confira o resumo do turno. Dá para imprimir para guardar junto com o dinheiro."
      />
      <div className="flex flex-col items-start gap-3 rounded-lg bg-surface-strong p-5">
        <StatusPill tone={tom}>{resultado.texto}</StatusPill>
        <dl className="flex w-full flex-col gap-1 text-body">
          <div className="flex justify-between text-ink-muted">
            <dt>Esperado na gaveta</dt>
            <dd className="tabular-nums">{formatarPreco(fechamento.esperado_cents)}</dd>
          </div>
          <div className="flex justify-between text-body-strong text-ink">
            <dt>Contado</dt>
            <dd className="tabular-nums">{formatarPreco(fechamento.contado_cents)}</dd>
          </div>
        </dl>
      </div>
      {resumo && (
        <Panel title="Vendas do turno">
          <LinhasDoResumo resumo={resumo} />
        </Panel>
      )}
      <div className="flex flex-wrap gap-2 print:hidden">
        <Button onClick={onVoltar}>Voltar ao painel</Button>
        <Button variant="secondary" onClick={() => window.print()}>
          Imprimir
        </Button>
      </div>
    </Tela>
  );
}
