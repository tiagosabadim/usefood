import { agenteLigado, tempoDesde } from '@usefood/core';
import type { AppSupabaseClient, Tables } from '@usefood/db';
import { Alert, Button, Panel, SegmentedControl, StatusPill, Switch, TextField } from '@usefood/ui';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Colunas, Tela, Titulo } from './tela';

type Praca = Pick<Tables<'stations'>, 'id' | 'name'>;
type Impressora = Pick<
  Tables<'printers'>,
  'id' | 'station_id' | 'name' | 'host' | 'port' | 'paper_width' | 'is_active'
>;
type Agente = Pick<
  Tables<'print_agents'>,
  'id' | 'name' | 'last_seen_at' | 'revoked_at' | 'version'
>;

const HOST = /^[A-Za-z0-9.-]{1,253}$/;
const PROGRAMA = 'usefood-impressao.mjs';

/** Praças, impressoras e computadores de impressão da loja. Só dono e gerente chegam aqui. */
export function Impressao({
  supabase,
  loja,
  onVoltar,
}: {
  supabase: AppSupabaseClient;
  loja: { id: string; name: string };
  onVoltar: () => void;
}) {
  const [pracas, setPracas] = useState<Praca[]>([]);
  const [impressoras, setImpressoras] = useState<Impressora[]>([]);
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [agora, setAgora] = useState(() => Date.now());
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [pareamento, setPareamento] = useState<{
    codigo: string;
    expiraEm: string;
    agentesAntes: number;
  } | null>(null);
  const [gerando, setGerando] = useState(false);
  const [adicionandoEm, setAdicionandoEm] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const [p, i, a] = await Promise.all([
      supabase
        .from('stations')
        .select('id, name')
        .eq('restaurant_id', loja.id)
        .order('position')
        .order('created_at'),
      supabase
        .from('printers')
        .select('id, station_id, name, host, port, paper_width, is_active')
        .eq('restaurant_id', loja.id)
        .order('created_at'),
      supabase
        .from('print_agents')
        .select('id, name, last_seen_at, revoked_at, version')
        .eq('restaurant_id', loja.id)
        .is('revoked_at', null)
        .order('created_at'),
    ]);
    if (p.error || i.error || a.error) {
      setErro('Não conseguimos carregar a impressão. Confira a internet.');
    } else {
      setPracas(p.data);
      setImpressoras(i.data);
      setAgentes(a.data);
    }
    setAgora(Date.now());
    setCarregando(false);
  }, [supabase, loja.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
    const t = setInterval(() => void carregar(), 10_000);
    return () => clearInterval(t);
  }, [carregar]);

  // Um computador novo apareceu depois do código: pareamento concluído
  useEffect(() => {
    if (pareamento && agentes.length > pareamento.agentesAntes) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPareamento(null);
      setAviso('Computador conectado. Rode "iniciar" nele e faça um teste de impressão.');
    }
  }, [agentes.length, pareamento]);

  async function gerarCodigo() {
    setErro('');
    setGerando(true);
    const { data, error } = await supabase.rpc('criar_codigo_de_pareamento', {
      p_restaurant_id: loja.id,
    });
    setGerando(false);
    const linha = data?.[0];
    if (error || !linha) {
      setErro('Não foi possível gerar o código agora.');
      return;
    }
    setPareamento({
      codigo: linha.codigo,
      expiraEm: linha.expira_em,
      agentesAntes: agentes.length,
    });
  }

  async function desligar(agente: Agente) {
    setErro('');
    const { error } = await supabase.rpc('desligar_agente', { p_agente: agente.id });
    if (error) setErro('Não foi possível desligar o computador agora.');
    else void carregar();
  }

  async function novaPraca(nome: string) {
    setErro('');
    const { error } = await supabase
      .from('stations')
      .insert({ restaurant_id: loja.id, name: nome, position: pracas.length });
    if (error) {
      setErro('Não foi possível criar a praça.');
      return false;
    }
    void carregar();
    return true;
  }

  async function salvarImpressora(dados: Omit<Impressora, 'id' | 'is_active'>) {
    setErro('');
    const { error } = await supabase.from('printers').insert({ ...dados, restaurant_id: loja.id });
    if (error) {
      setErro('Não foi possível salvar a impressora. Confira o IP.');
      return false;
    }
    setAdicionandoEm(null);
    void carregar();
    return true;
  }

  async function alternar(impressora: Impressora, ativa: boolean) {
    const { error } = await supabase
      .from('printers')
      .update({ is_active: ativa })
      .eq('id', impressora.id);
    if (error) setErro('Não foi possível mudar a impressora.');
    else void carregar();
  }

  async function remover(impressora: Impressora) {
    const { error } = await supabase.from('printers').delete().eq('id', impressora.id);
    if (error) setErro('Não foi possível remover a impressora.');
    else void carregar();
  }

  async function testar(impressora: Impressora) {
    setErro('');
    setAviso('');
    const { data: job, error } = await supabase.rpc('imprimir_teste', {
      p_impressora: impressora.id,
    });
    if (error || !job) {
      setErro('Não foi possível mandar o teste.');
      return;
    }
    setAviso(`Teste enviado para ${impressora.name}. Aguardando a impressora…`);
    for (let tentativa = 0; tentativa < 10; tentativa++) {
      await new Promise((r) => setTimeout(r, 1500));
      const { data } = await supabase
        .from('print_jobs')
        .select('status, error')
        .eq('id', job)
        .maybeSingle();
      if (data?.status === 'impresso') {
        setAviso(`${impressora.name} imprimiu o teste.`);
        return;
      }
      if (data?.status === 'falhou') {
        setAviso('');
        setErro(`${impressora.name} não imprimiu: ${data.error ?? 'erro na impressora'}`);
        return;
      }
    }
    setAviso('');
    setErro(
      `${impressora.name} não respondeu em 15 segundos. O computador de impressão está ligado e com o programa aberto?`,
    );
  }

  if (carregando) {
    return (
      <Tela larga>
        <p className="text-body text-ink-muted">Carregando a impressão…</p>
      </Tela>
    );
  }

  return (
    <Tela larga>
      <Button variant="ghost" className="self-start px-0 lg:hidden" onClick={onVoltar}>
        ← {loja.name}
      </Button>
      <Titulo
        titulo="Impressão"
        texto="Cada pedido sai sozinho na impressora da praça certa. Um computador da loja, ligado e com o programa aberto, faz a ponte."
      />
      <Alert>{erro}</Alert>
      <Alert tone="sucesso">{aviso}</Alert>

      <Colunas
        esquerda={
          <>
            <Panel title="Computador de impressão">
              {agentes.length === 0 && !pareamento && (
                <p className="text-body text-ink-muted">
                  Nenhum computador conectado ainda. Use um computador que fique ligado na loja, na
                  mesma rede das impressoras.
                </p>
              )}
              {agentes.length > 0 && (
                <ul className="flex flex-col divide-y divide-line">
                  {agentes.map((a) => {
                    const ligado = agenteLigado(
                      {
                        id: a.id,
                        nome: a.name,
                        vistoEm: a.last_seen_at,
                        desligado: a.revoked_at !== null,
                      },
                      agora,
                    );
                    return (
                      <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-body-strong text-ink">{a.name}</p>
                          <p className="text-caption text-ink-muted">
                            {a.last_seen_at
                              ? `Último sinal ${tempoDesde(a.last_seen_at, agora)}`
                              : 'Ainda não deu sinal'}
                            {a.version && ` · versão ${a.version}`}
                          </p>
                        </div>
                        <StatusPill tone={ligado ? 'sucesso' : 'neutro'}>
                          {ligado ? 'Ligado' : 'Desligado'}
                        </StatusPill>
                        <Button
                          variant="ghost"
                          className="text-danger"
                          onClick={() => void desligar(a)}
                        >
                          Desconectar
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {pareamento ? (
                <Pareamento
                  codigo={pareamento.codigo}
                  expiraEm={pareamento.expiraEm}
                  onCancelar={() => setPareamento(null)}
                />
              ) : (
                <Button
                  variant="secondary"
                  className="self-start"
                  loading={gerando}
                  onClick={() => void gerarCodigo()}
                >
                  Conectar um computador
                </Button>
              )}
            </Panel>
          </>
        }
        direita={
          <>
            {pracas.map((praca) => {
              const daPraca = impressoras.filter((i) => i.station_id === praca.id);
              return (
                <Panel key={praca.id} id={`praca-${praca.id}`} title={praca.name}>
                  {daPraca.length === 0 && (
                    <p className="text-body text-ink-muted">
                      Sem impressora: os pedidos desta praça não vão sair no papel.
                    </p>
                  )}
                  <ul className="flex flex-col divide-y divide-line">
                    {daPraca.map((i) => (
                      <li key={i.id} className="flex flex-wrap items-center gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-body-strong text-ink">{i.name}</p>
                          <p className="text-caption text-ink-muted tabular-nums">
                            {i.host}:{i.port} · papel {i.paper_width} mm
                          </p>
                        </div>
                        <Switch
                          checked={i.is_active}
                          onChange={(v) => void alternar(i, v)}
                          label={`${i.name}: ativa`}
                        />
                        <Button
                          variant="secondary"
                          disabled={!i.is_active}
                          onClick={() => void testar(i)}
                        >
                          Imprimir teste
                        </Button>
                        <Button
                          variant="ghost"
                          className="text-danger"
                          onClick={() => void remover(i)}
                        >
                          Remover
                        </Button>
                      </li>
                    ))}
                  </ul>
                  {adicionandoEm === praca.id ? (
                    <NovaImpressora
                      pracaId={praca.id}
                      onSalvar={salvarImpressora}
                      onCancelar={() => setAdicionandoEm(null)}
                    />
                  ) : (
                    <Button
                      variant="ghost"
                      className="self-start px-0 text-brand-text"
                      onClick={() => setAdicionandoEm(praca.id)}
                    >
                      + Adicionar impressora
                    </Button>
                  )}
                </Panel>
              );
            })}

            <NovaPraca onSalvar={novaPraca} />
          </>
        }
      />
    </Tela>
  );
}

function Pareamento({
  codigo,
  expiraEm,
  onCancelar,
}: {
  codigo: string;
  expiraEm: string;
  onCancelar: () => void;
}) {
  const [agora, setAgora] = useState(() => Date.now());
  const [copiado, setCopiado] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const restante = Math.max(0, Math.floor((Date.parse(expiraEm) - agora) / 1000));
  const servidor = String(import.meta.env.VITE_SUPABASE_URL ?? '');
  const download = `${window.location.origin}/downloads/${PROGRAMA}`;
  const comando = `node ${PROGRAMA} parear ${codigo} --servidor ${servidor} --nome "Computador do caixa"`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(comando);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  if (restante === 0) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-md bg-surface-strong p-4">
        <p className="text-body text-ink">
          O código venceu. Gere outro quando estiver na frente do computador da loja.
        </p>
        <Button variant="secondary" onClick={onCancelar}>
          Fechar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-md bg-surface-strong p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="font-display text-display tracking-widest text-ink">{codigo}</span>
        <span className="text-caption text-ink-muted tabular-nums">
          vale por mais {Math.floor(restante / 60)}:{String(restante % 60).padStart(2, '0')}
        </span>
      </div>
      <ol className="flex list-decimal flex-col gap-3 pl-5 text-body text-ink">
        <li>
          No computador da loja, instale o <strong>Node.js</strong> (versão 22 ou mais nova) pelo
          site{' '}
          <a
            href="https://nodejs.org"
            target="_blank"
            rel="noreferrer"
            className="text-brand-text underline"
          >
            nodejs.org
          </a>
          .
        </li>
        <li>
          Baixe o programa de impressão:{' '}
          <a href={download} download className="text-brand-text underline">
            {PROGRAMA}
          </a>
          .
        </li>
        <li>
          Abra o terminal na pasta onde o programa foi salvo e cole este comando:
          <code className="mt-2 block overflow-x-auto rounded-sm bg-canvas p-3 font-mono text-caption whitespace-pre text-ink">
            {comando}
          </code>
          <Button variant="secondary" className="mt-2" onClick={() => void copiar()}>
            {copiado ? 'Copiado' : 'Copiar comando'}
          </Button>
        </li>
        <li>
          Depois rode <code className="font-mono text-caption">node {PROGRAMA} iniciar</code> e
          deixe a janela aberta.
        </li>
      </ol>
      <p className="text-caption text-ink-muted">
        Esta tela avisa sozinha quando o computador conectar.
      </p>
      <Button variant="ghost" className="self-start px-0" onClick={onCancelar}>
        Cancelar
      </Button>
    </div>
  );
}

function NovaImpressora({
  pracaId,
  onSalvar,
  onCancelar,
}: {
  pracaId: string;
  onSalvar: (dados: Omit<Impressora, 'id' | 'is_active'>) => Promise<boolean>;
  onCancelar: () => void;
}) {
  const [nome, setNome] = useState('');
  const [host, setHost] = useState('');
  const [porta, setPorta] = useState('9100');
  const [papel, setPapel] = useState<'80' | '58'>('80');
  const [salvando, setSalvando] = useState(false);

  const hostValido = HOST.test(host.trim());
  const portaNumero = Number(porta);
  const portaValida = Number.isInteger(portaNumero) && portaNumero >= 1 && portaNumero <= 65535;

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!nome.trim() || !hostValido || !portaValida) return;
    setSalvando(true);
    await onSalvar({
      station_id: pracaId,
      name: nome.trim(),
      host: host.trim(),
      port: portaNumero,
      paper_width: Number(papel),
    });
    setSalvando(false);
  }

  return (
    <form
      onSubmit={enviar}
      className="flex flex-col gap-4 rounded-md border border-line bg-canvas p-4"
    >
      <TextField
        label="Nome"
        placeholder="Ex.: Térmica da cozinha"
        maxLength={40}
        required
        value={nome}
        onChange={(e) => setNome(e.target.value)}
      />
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem]">
        <TextField
          label="IP da impressora"
          placeholder="192.168.0.50"
          inputMode="decimal"
          autoCapitalize="none"
          spellCheck={false}
          value={host}
          onChange={(e) => setHost(e.target.value)}
          error={host && !hostValido ? 'Confira o IP, por exemplo 192.168.0.50.' : undefined}
          hint="Aparece na folha de configuração que a impressora imprime ao ligar segurando o botão de avanço."
        />
        <TextField
          label="Porta"
          inputMode="numeric"
          value={porta}
          onChange={(e) => setPorta(e.target.value.replace(/\D/g, ''))}
          error={!portaValida ? 'Use 9100.' : undefined}
        />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-label text-ink">Largura do papel</span>
        <SegmentedControl
          label="Largura do papel"
          className="self-start"
          options={[
            { value: '80', label: '80 mm' },
            { value: '58', label: '58 mm' },
          ]}
          value={papel}
          onChange={setPapel}
        />
      </div>
      <div className="flex gap-3">
        <Button
          type="submit"
          loading={salvando}
          disabled={!nome.trim() || !hostValido || !portaValida}
        >
          Salvar impressora
        </Button>
        <Button variant="ghost" onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function NovaPraca({ onSalvar }: { onSalvar: (nome: string) => Promise<boolean> }) {
  const [nome, setNome] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!nome.trim()) return;
    setSalvando(true);
    if (await onSalvar(nome.trim())) setNome('');
    setSalvando(false);
  }

  return (
    <form onSubmit={enviar} className="flex flex-wrap items-end gap-3">
      <TextField
        label="Nova praça"
        placeholder="Ex.: Bar, Sobremesas, Pizzaria"
        className="min-w-56 flex-1"
        maxLength={40}
        value={nome}
        onChange={(e) => setNome(e.target.value)}
      />
      <Button type="submit" variant="secondary" loading={salvando} disabled={!nome.trim()}>
        Criar praça
      </Button>
    </form>
  );
}
