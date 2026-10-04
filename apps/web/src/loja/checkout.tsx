import {
  formatarPreco,
  lerCep,
  lerPreco,
  lerTelefone,
  subtotalCentavos,
  type ItemCarrinho,
  type MetodoPagamento,
} from '@usefood/core';
import type { AppSupabaseClient } from '@usefood/db';
import { Alert, Button, ChoiceGrid, Panel, SegmentedControl, TextField } from '@usefood/ui';
import { useEffect, useState, type FormEvent } from 'react';
import { gravarCliente, lerCliente, type DadosDoCliente } from '../guardado';
import type { LojaPublica } from './dados';

type Cotacao = { atende: true; taxa: number } | { atende: false; motivo: string } | null;
const ERROS = new Set(['P0001', 'P0002', '22023']);

/** Fechar o pedido: entrega ou retirada, dados do cliente, taxa calculada pelo banco e pagamento. */
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
  const [tipo, setTipo] = useState<'delivery' | 'retirada'>(
    loja.accepts_delivery ? 'delivery' : 'retirada',
  );
  const [c, setC] = useState<DadosDoCliente>(() => lerCliente());
  const [ponto, setPonto] = useState<{ lat: number; lng: number } | null>(null);
  const [pagamento, setPagamento] = useState<MetodoPagamento | null>(null);
  const [trocoPara, setTrocoPara] = useState('');
  const [observacao, setObservacao] = useState('');
  const [cotacao, setCotacao] = useState<Cotacao>(null);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [localizando, setLocalizando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const subtotal = subtotalCentavos(itens);
  const precisaLocalizacao = loja.delivery_fee_mode === 'distancia';
  const campo = (nome: keyof DadosDoCliente) => ({
    value: c[nome],
    onChange: (e: { target: { value: string } }) => setC({ ...c, [nome]: e.target.value }),
  });

  // Taxa de entrega: pergunta ao banco sempre que bairro, cidade ou localização mudam
  useEffect(() => {
    if (tipo !== 'delivery') return;
    const t = setTimeout(() => {
      void supabase
        .rpc('calcular_entrega', {
          p_restaurant_id: loja.id,
          p_bairro: c.bairro.trim() || null,
          p_cidade: c.cidade.trim() || null,
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
  }, [supabase, loja.id, tipo, c.bairro, c.cidade, ponto, subtotal]);

  async function buscarCep() {
    const cep = lerCep(c.cep);
    if (!cep) return setErro('O CEP tem 8 números.');
    setBuscandoCep(true);
    try {
      const j = (await (await fetch(`https://viacep.com.br/ws/${cep}/json/`)).json()) as {
        erro?: boolean;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
      };
      if (j.erro) setErro('CEP não encontrado. Preencha o endereço.');
      else {
        setErro('');
        setC({
          ...c,
          rua: j.logradouro || c.rua,
          bairro: j.bairro || c.bairro,
          cidade: j.localidade || c.cidade,
        });
      }
    } catch {
      setErro('Não foi possível buscar o CEP agora. Preencha o endereço.');
    } finally {
      setBuscandoCep(false);
    }
  }

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
  const celular = lerTelefone(c.celular);
  const troco = pagamento === 'dinheiro' && trocoPara.trim() ? lerPreco(trocoPara) : null;
  const faltando = !aberta
    ? 'A loja está fechada agora.'
    : !c.nome.trim()
      ? 'Informe seu nome.'
      : !celular
        ? 'Informe o celular com DDD.'
        : tipo === 'delivery' && (!c.rua.trim() || !c.numero.trim() || !c.bairro.trim())
          ? 'Informe rua, número e bairro.'
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
    if (faltando || !pagamento || !celular) return;
    setErro('');
    setEnviando(true);
    gravarCliente(c);
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
      p_nome: c.nome.trim(),
      p_celular: celular,
      p_pagamento: pagamento,
      p_troco_para_cents: troco,
      p_endereco:
        tipo === 'delivery'
          ? {
              cep: lerCep(c.cep),
              rua: c.rua.trim(),
              numero: c.numero.trim(),
              complemento: c.complemento.trim(),
              bairro: c.bairro.trim(),
              cidade: c.cidade.trim(),
              referencia: c.referencia.trim(),
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
    onFeito(r.token);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-5 px-5 py-6 pb-28">
      <button type="button" className="self-start text-label text-ink-muted" onClick={onVoltar}>
        ← Voltar ao cardápio
      </button>
      <h1 className="font-display text-title-screen text-ink">Finalizar pedido</h1>
      {!aberta && (
        <Alert>A loja está fechada agora. Você pode montar a sacola e pedir quando abrir.</Alert>
      )}

      <form className="flex flex-col gap-5" onSubmit={enviar}>
        {loja.accepts_delivery && loja.accepts_pickup && (
          <SegmentedControl
            label="Entrega ou retirada"
            className="self-start"
            options={[
              { value: 'delivery', label: 'Entregar' },
              { value: 'retirada', label: 'Retirar na loja' },
            ]}
            value={tipo}
            onChange={setTipo}
          />
        )}

        <Panel title="Seus dados">
          <TextField label="Nome" autoComplete="name" maxLength={60} {...campo('nome')} />
          <TextField
            label="Celular com DDD"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(17) 99123-4567"
            {...campo('celular')}
          />
        </Panel>

        {tipo === 'delivery' ? (
          <Panel title="Endereço de entrega">
            <div className="flex items-end gap-3">
              <TextField
                label="CEP"
                inputMode="numeric"
                autoComplete="postal-code"
                className="w-40"
                maxLength={9}
                {...campo('cep')}
              />
              <Button variant="secondary" loading={buscandoCep} onClick={() => void buscarCep()}>
                Buscar
              </Button>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
              <TextField label="Rua" autoComplete="address-line1" {...campo('rua')} />
              <TextField label="Número" {...campo('numero')} />
            </div>
            <TextField label="Complemento (opcional)" {...campo('complemento')} />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Bairro" {...campo('bairro')} />
              <TextField label="Cidade" {...campo('cidade')} />
            </div>
            <TextField label="Ponto de referência (opcional)" {...campo('referencia')} />
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

        <Panel title={`Pagamento na ${tipo === 'delivery' ? 'entrega' : 'retirada'}`}>
          <ChoiceGrid
            label="Como vai pagar"
            options={[
              { value: 'dinheiro', label: 'Dinheiro' },
              { value: 'pix', label: 'Pix' },
              { value: 'credito', label: 'Crédito' },
              { value: 'debito', label: 'Débito' },
            ]}
            value={pagamento}
            onChange={setPagamento}
          />
          {pagamento === 'dinheiro' && (
            <TextField
              label="Troco para (opcional)"
              inputMode="decimal"
              placeholder="Ex.: 100,00"
              value={trocoPara}
              onChange={(e) => setTrocoPara(e.target.value)}
            />
          )}
        </Panel>

        <TextField
          label="Observação para a loja (opcional)"
          maxLength={300}
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
        />

        <dl className="flex flex-col gap-1 text-body">
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
          <div className="flex justify-between text-body-strong text-ink">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatarPreco(total)}</dd>
          </div>
        </dl>

        <Alert>{erro}</Alert>
        <div className="fixed inset-x-0 bottom-0 border-t border-line bg-canvas px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
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
