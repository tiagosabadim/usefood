import {
  formatarPreco,
  formatarTelefone,
  lerCep,
  lerPreco,
  lerTelefone,
  subtotalCentavos,
  type ItemCarrinho,
  type MetodoPagamento,
} from '@usefood/core';
import type { AppSupabaseClient } from '@usefood/db';
import { Alert, Button, cn, Icon, Panel, SelectField, Switch, TextField } from '@usefood/ui';
import { useEffect, useState, type FormEvent } from 'react';
import {
  ENDERECO_EM_BRANCO,
  gravarConta,
  lerConta,
  novoId,
  temConta,
  type Conta,
} from '../guardado';
import { navegar } from '../rotas';
import type { LojaPublica } from './dados';
import {
  CamposDeEndereco,
  enderecoCompleto,
  resumoDoEndereco,
  type EnderecoEditavel,
} from './endereco-form';

type Cotacao = { atende: true; taxa: number } | { atende: false; motivo: string } | null;
const ERROS = new Set(['P0001', 'P0002', '22023']);
const OUTRO = 'outro';

/** Fechar o pedido. No primeiro pedido, a conta deste aparelho é criada com nome, celular e o endereço. */
export function Checkout({
  supabase,
  loja,
  aberta,
  itens,
  onVoltar,
  onFeito,
}: {
  supabase: AppSupabaseClient;
  loja: LojaPublica;
  aberta: boolean;
  itens: ItemCarrinho[];
  onVoltar: () => void;
  onFeito: (token: string) => void;
}) {
  const [conta] = useState<Conta>(() => lerConta());
  const [tipo, setTipo] = useState<'delivery' | 'retirada'>(
    loja.accepts_delivery ? 'delivery' : 'retirada',
  );
  const [nome, setNome] = useState(conta.nome);
  const [celular, setCelular] = useState(conta.celular ? formatarTelefone(conta.celular) : '');
  const [escolhido, setEscolhido] = useState<string>(conta.enderecos[0]?.id ?? OUTRO);
  const [novo, setNovo] = useState<EnderecoEditavel>({
    ...ENDERECO_EM_BRANCO,
    apelido: conta.enderecos.length ? '' : 'Casa',
  });
  const [salvarNovo, setSalvarNovo] = useState(true);
  const [ponto, setPonto] = useState<{ lat: number; lng: number } | null>(null);
  const [pagamento, setPagamento] = useState<MetodoPagamento | null>(null);
  const [trocoPara, setTrocoPara] = useState('');
  const [observacao, setObservacao] = useState('');
  const [cotacao, setCotacao] = useState<Cotacao>(null);
  const [localizando, setLocalizando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const subtotal = subtotalCentavos(itens);
  const precisaLocalizacao = loja.delivery_fee_mode === 'distancia';
  const salvo = conta.enderecos.find((e) => e.id === escolhido);
  const endereco: EnderecoEditavel = salvo ?? novo;

  // Taxa de entrega: pergunta ao banco quando o bairro, a cidade ou a localização mudam
  useEffect(() => {
    if (tipo !== 'delivery') return;
    const t = setTimeout(() => {
      void supabase
        .rpc('calcular_entrega', {
          p_restaurant_id: loja.id,
          p_bairro: endereco.bairro.trim() || null,
          p_cidade: endereco.cidade.trim() || null,
          p_latitude: ponto?.lat ?? null,
          p_longitude: ponto?.lng ?? null,
          p_subtotal_cents: subtotal,
        })
        .then(({ data }) => {
          const r = data?.[0];
          if (!r) return setCotacao(null);
          setCotacao(
            r.atende
              ? { atende: true, taxa: r.taxa_cents }
              : { atende: false, motivo: r.motivo ?? 'Não entregamos aí.' },
          );
        });
    }, 500);
    return () => clearTimeout(t);
  }, [supabase, loja.id, tipo, endereco.bairro, endereco.cidade, ponto, subtotal]);

  function usarLocalizacao() {
    if (!navigator.geolocation) return setErro('Este aparelho não informa a localização.');
    setLocalizando(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocalizando(false);
        setPonto({ lat: p.coords.latitude, lng: p.coords.longitude });
      },
      () => {
        setLocalizando(false);
        setErro('Não conseguimos sua localização. Permita o acesso no navegador e tente de novo.');
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  const taxa = tipo === 'delivery' && cotacao?.atende ? cotacao.taxa : 0;
  const total = subtotal + taxa;
  const cel = lerTelefone(celular);
  const troco = pagamento === 'dinheiro' && trocoPara.trim() ? lerPreco(trocoPara) : null;
  const faltando = !aberta
    ? 'A loja está fechada agora.'
    : !nome.trim()
      ? 'Informe seu nome.'
      : !cel
        ? 'Informe o celular com DDD.'
        : tipo === 'delivery' && !enderecoCompleto(endereco)
          ? 'Informe rua, número e bairro.'
          : tipo === 'delivery' && !salvo && salvarNovo && !novo.apelido.trim()
            ? 'Dê um nome ao endereço, como Casa ou Trabalho.'
            : tipo === 'delivery' && precisaLocalizacao && !ponto
              ? 'Use sua localização para calcular a entrega.'
              : tipo === 'delivery' && cotacao && !cotacao.atende
                ? cotacao.motivo
                : !pagamento
                  ? 'Escolha como vai pagar.'
                  : pagamento === 'dinheiro' && trocoPara.trim() && troco === null
                    ? 'Confira o valor do troco.'
                    : null;

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (faltando || !pagamento || !cel) return;
    setErro('');
    setEnviando(true);
    const { data, error } = await supabase.rpc('fazer_pedido_online', {
      p_restaurant_id: loja.id,
      p_tipo: tipo,
      p_itens: itens.map((i) => ({
        product_id: i.productId,
        quantidade: i.quantidade,
        variant_id: i.tamanhoId,
        adicionais: i.adicionais.map((a) => a.id),
        observacao: i.observacao || null,
      })),
      p_nome: nome.trim(),
      p_celular: cel,
      p_pagamento: pagamento,
      p_troco_para_cents: troco,
      p_endereco:
        tipo === 'delivery'
          ? {
              cep: lerCep(endereco.cep),
              rua: endereco.rua.trim(),
              numero: endereco.numero.trim(),
              complemento: endereco.complemento.trim(),
              bairro: endereco.bairro.trim(),
              cidade: endereco.cidade.trim(),
              referencia: endereco.referencia.trim(),
            }
          : null,
      p_latitude: tipo === 'delivery' ? (ponto?.lat ?? null) : null,
      p_longitude: tipo === 'delivery' ? (ponto?.lng ?? null) : null,
      p_observacao: observacao.trim() || null,
    });
    setEnviando(false);
    const r = data?.[0];
    if (error || !r) {
      setErro(
        error?.code && ERROS.has(error.code)
          ? error.message
          : 'Não foi possível enviar agora. Confira a internet e tente de novo.',
      );
      return;
    }
    // Conta deste aparelho: criada no primeiro pedido, atualizada nos próximos
    const atual = lerConta();
    const guardarEndereco = tipo === 'delivery' && !salvo && salvarNovo;
    gravarConta({
      nome: nome.trim(),
      celular: cel,
      enderecos: guardarEndereco
        ? [...atual.enderecos, { ...novo, apelido: novo.apelido.trim(), id: novoId() }]
        : atual.enderecos,
      pedidos: [
        {
          token: r.token,
          lojaSlug: loja.slug,
          lojaNome: loja.name,
          numero: r.numero,
          criadoEm: new Date().toISOString(),
        },
        ...atual.pedidos,
      ].slice(0, 30),
    });
    onFeito(r.token);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-5 px-5 py-6 pb-32">
      <header className="sticky top-0 z-20 -mx-5 -mt-6 flex items-center gap-1 border-b border-line bg-canvas px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
        <button
          type="button"
          aria-label="Voltar ao cardápio"
          onClick={onVoltar}
          className="flex size-11 items-center justify-center rounded-pill text-ink focus-visible:outline-2 focus-visible:outline-brand"
        >
          <Icon name="voltar" size={22} />
        </button>
        <h1 className="text-title-section font-extrabold tracking-[-0.02em] text-ink">
          Finalizar pedido
        </h1>
      </header>
      {!aberta && (
        <Alert>A loja está fechada agora. Você pode montar a sacola e pedir quando abrir.</Alert>
      )}

      <form className="flex flex-col gap-5" onSubmit={enviar}>
        {loja.accepts_delivery && loja.accepts_pickup && (
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 text-title-section font-extrabold text-ink">
              Tipo de entrega
            </legend>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ['delivery', 'Entrega', 'moto'],
                  ['retirada', 'Retirada no local', 'loja'],
                ] as const
              ).map(([valor, rotulo, icone]) => (
                <label
                  key={valor}
                  className={cn(
                    'flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border bg-surface px-4 transition',
                    tipo === valor ? 'border-brand ring-1 ring-brand' : 'border-line',
                  )}
                >
                  <input
                    type="radio"
                    name="tipo"
                    className="size-5 shrink-0 accent-[var(--uf-brand)]"
                    checked={tipo === valor}
                    onChange={() => setTipo(valor)}
                  />
                  <Icon name={icone} size={20} className="shrink-0 text-brand-text" />
                  <span className="text-label font-bold text-ink">{rotulo}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <Panel title="Seus dados">
          {temConta(conta) && (
            <p className="text-caption text-ink-muted">
              Preenchido com a sua conta neste aparelho.
            </p>
          )}
          <TextField
            label="Nome"
            autoComplete="name"
            maxLength={60}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <TextField
            label="Celular com DDD"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(17) 99123-4567"
            value={celular}
            onChange={(e) => setCelular(e.target.value)}
          />
        </Panel>

        {tipo === 'delivery' ? (
          <Panel title="Endereço de entrega">
            {conta.enderecos.length > 0 && (
              <SelectField
                label="Entregar em"
                options={[
                  ...conta.enderecos.map((e) => ({
                    value: e.id,
                    label: `${e.apelido} · ${e.rua}, ${e.numero}`,
                  })),
                  { value: OUTRO, label: 'Outro endereço' },
                ]}
                value={escolhido}
                onChange={setEscolhido}
              />
            )}
            {salvo ? (
              <div className="flex flex-col gap-1 rounded-md bg-surface-strong p-3">
                <p className="text-body text-ink">{resumoDoEndereco(salvo)}</p>
                {salvo.referencia && (
                  <p className="text-caption text-ink-muted">Referência: {salvo.referencia}</p>
                )}
                <button
                  type="button"
                  className="self-start text-label text-brand-text underline"
                  onClick={() => navegar(window.location.pathname.replace(/\/?$/, '/conta'))}
                >
                  Editar endereços
                </button>
              </div>
            ) : (
              <>
                <CamposDeEndereco valor={novo} onChange={setNovo} />
                <Switch
                  checked={salvarNovo}
                  onChange={setSalvarNovo}
                  label="Salvar este endereço para os próximos pedidos"
                  showLabel
                />
                {salvarNovo && (
                  <TextField
                    label="Nome do endereço"
                    placeholder="Ex.: Casa, Trabalho"
                    maxLength={30}
                    value={novo.apelido}
                    onChange={(e) => setNovo({ ...novo, apelido: e.target.value })}
                  />
                )}
              </>
            )}
            {(precisaLocalizacao || loja.delivery_fee_mode === 'gratis') && (
              <div className="flex flex-col gap-1">
                <Button
                  variant="secondary"
                  className="self-start"
                  loading={localizando}
                  onClick={usarLocalizacao}
                >
                  {ponto ? 'Localização marcada' : 'Usar minha localização'}
                </Button>
                <p className="text-caption text-ink-muted">
                  {precisaLocalizacao
                    ? 'Necessária para calcular a entrega pela distância.'
                    : 'Ajuda o entregador a achar você.'}
                </p>
              </div>
            )}
            {cotacao &&
              (cotacao.atende ? (
                <p className="text-body-strong text-ink">
                  Entrega: {cotacao.taxa ? formatarPreco(cotacao.taxa) : 'grátis'}
                </p>
              ) : (
                <Alert>{cotacao.motivo}</Alert>
              ))}
          </Panel>
        ) : (
          <Panel title="Retirada na loja">
            <p className="text-body text-ink">
              {loja.street}, {loja.street_number} · {loja.district}
            </p>
            <p className="text-caption text-ink-muted">Avisamos aqui quando estiver pronto.</p>
          </Panel>
        )}

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 text-title-section font-extrabold text-ink">
            Como vai pagar na {tipo === 'delivery' ? 'entrega' : 'retirada'}
          </legend>
          <div className="flex flex-col divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            {(
              [
                ['pix', 'Pix', 'pix'],
                ['credito', 'Cartão de crédito', 'cartao'],
                ['debito', 'Cartão de débito', 'cartao'],
                ['dinheiro', 'Dinheiro', 'dinheiro'],
              ] as const
            ).map(([valor, rotulo, icone]) => (
              <label key={valor} className="flex min-h-14 cursor-pointer items-center gap-3 px-4">
                <Icon name={icone} size={22} className="shrink-0 text-brand-text" />
                <span className="flex-1 text-body text-ink">{rotulo}</span>
                <input
                  type="radio"
                  name="pagamento"
                  className="size-5 shrink-0 accent-[var(--uf-brand)]"
                  checked={pagamento === valor}
                  onChange={() => setPagamento(valor)}
                />
              </label>
            ))}
          </div>
          {pagamento === 'dinheiro' && (
            <TextField
              label="Troco para (opcional)"
              inputMode="decimal"
              placeholder="Ex.: 100,00"
              value={trocoPara}
              onChange={(e) => setTrocoPara(e.target.value)}
            />
          )}
        </fieldset>

        <TextField
          label="Observação para a loja (opcional)"
          maxLength={300}
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
        />

        <dl className="flex flex-col gap-2 rounded-lg bg-surface p-4 text-body">
          <div className="flex justify-between text-ink-muted">
            <dt>Itens</dt>
            <dd className="tabular-nums">{formatarPreco(subtotal)}</dd>
          </div>
          {tipo === 'delivery' && (
            <div className="flex justify-between text-ink-muted">
              <dt>Entrega</dt>
              <dd className="tabular-nums">
                {cotacao?.atende ? (taxa ? formatarPreco(taxa) : 'Grátis') : '—'}
              </dd>
            </div>
          )}
          <div className="flex justify-between border-t border-line pt-2 text-title-section font-black text-ink">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatarPreco(total)}</dd>
          </div>
        </dl>

        <Alert>{erro}</Alert>
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-canvas px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-xl flex-col gap-1">
            {faltando && <p className="text-center text-caption text-ink-muted">{faltando}</p>}
            <Button
              type="submit"
              className="h-target-pdv w-full"
              loading={enviando}
              disabled={Boolean(faltando)}
            >
              Fazer pedido · {formatarPreco(total)}
            </Button>
          </div>
        </div>
      </form>
    </main>
  );
}
