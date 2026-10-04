import { rotuloDoPapel, tempoDesde, type Papel } from '@usefood/core';
import type { AppSupabaseClient, Database } from '@usefood/db';
import { Alert, Button, ChoiceGrid, Panel, StatusPill, TextField } from '@usefood/ui';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { mensagemDaFuncao } from './funcoes';
import { Tela, Titulo } from './tela';

type Membro = Database['public']['Functions']['membros_da_equipe']['Returns'][number];
interface Aparelho {
  id: string;
  name: string;
  last_used_at: string | null;
}

/** Pessoas da equipe (com PIN) e aparelhos da loja onde elas entram. Dono e gerente. */
export function Equipe({
  supabase,
  loja,
  souDono,
  onVoltar,
}: {
  supabase: AppSupabaseClient;
  loja: { id: string; name: string };
  souDono: boolean;
  onVoltar: () => void;
}) {
  const [membros, setMembros] = useState<Membro[]>([]);
  const [aparelhos, setAparelhos] = useState<Aparelho[]>([]);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [trocandoPin, setTrocandoPin] = useState<string | null>(null);
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [codigo, setCodigo] = useState<{ codigo: string; expiraEm: string } | null>(null);
  const [agora, setAgora] = useState(() => Date.now());

  const carregar = useCallback(async () => {
    const [m, a] = await Promise.all([
      supabase.rpc('membros_da_equipe', { p_restaurant_id: loja.id }),
      supabase
        .from('staff_devices')
        .select('id, name, last_used_at')
        .eq('restaurant_id', loja.id)
        .is('revoked_at', null)
        .order('created_at'),
    ]);
    if (m.error || a.error) {
      setErro('Não conseguimos carregar a equipe.');
      return;
    }
    setMembros(m.data);
    setAparelhos(a.data);
    setAgora(Date.now());
  }, [supabase, loja.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
    const t = setInterval(() => void carregar(), 10_000);
    return () => clearInterval(t);
  }, [carregar]);

  async function remover(membro: Membro) {
    setErro('');
    const { error } = await supabase.functions.invoke('equipe-gestao', {
      body: { acao: 'remover', loja: loja.id, pessoa: membro.user_id },
    });
    setRemovendo(null);
    if (error) setErro(await mensagemDaFuncao(error));
    else setAviso(`${membro.nome} saiu da equipe.`);
    void carregar();
  }

  async function gerarCodigo() {
    setErro('');
    const { data, error } = await supabase.rpc('criar_codigo_de_pareamento', {
      p_restaurant_id: loja.id,
      p_tipo: 'equipe',
    });
    const linha = data?.[0];
    if (error || !linha) setErro('Não foi possível gerar o código agora.');
    else setCodigo({ codigo: linha.codigo, expiraEm: linha.expira_em });
  }

  async function desconectar(aparelho: Aparelho) {
    const { error } = await supabase.rpc('desconectar_aparelho', { p_aparelho: aparelho.id });
    if (error) setErro('Não foi possível desconectar o aparelho.');
    void carregar();
  }

  const restante = codigo
    ? Math.max(0, Math.floor((Date.parse(codigo.expiraEm) - agora) / 1000))
    : 0;

  return (
    <Tela larga>
      <Button variant="ghost" className="self-start px-0" onClick={onVoltar}>
        ← {loja.name}
      </Button>
      <Titulo
        titulo="Equipe"
        texto="Garçons, caixas e cozinha entram num aparelho da loja só com o PIN de 4 números, sem e-mail."
      />
      <Alert>{erro}</Alert>
      <Alert tone="sucesso">{aviso}</Alert>

      <Panel
        title="Pessoas"
        actions={<span className="text-caption text-ink-muted">{membros.length} na equipe</span>}
      >
        <ul className="flex flex-col divide-y divide-line">
          {membros.map((m) => (
            <li key={m.user_id} className="flex flex-col gap-3 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-body-strong text-ink">
                    {m.nome}
                    {m.e_voce && <span className="text-ink-muted"> (você)</span>}
                  </p>
                  <p className="text-caption text-ink-muted">{rotuloDoPapel(m.papel as Papel)}</p>
                </div>
                <StatusPill tone={m.tem_pin ? 'sucesso' : 'neutro'}>
                  {m.tem_pin ? 'Tem PIN' : 'Sem PIN'}
                </StatusPill>
                {(m.papel !== 'dono' || m.e_voce) && (
                  <Button
                    variant="ghost"
                    onClick={() => setTrocandoPin(trocandoPin === m.user_id ? null : m.user_id)}
                  >
                    {m.tem_pin ? 'Trocar PIN' : 'Criar PIN'}
                  </Button>
                )}
                {!m.e_voce && m.papel !== 'dono' && (
                  <Button
                    variant="ghost"
                    className="text-danger"
                    onClick={() => setRemovendo(m.user_id)}
                  >
                    Remover
                  </Button>
                )}
              </div>
              {removendo === m.user_id && (
                <div className="flex flex-wrap items-center gap-2 rounded-md bg-surface-strong p-3">
                  <span className="flex-1 text-body text-ink">
                    {m.nome} sai da equipe e não entra mais nos aparelhos.
                  </span>
                  <Button variant="danger" onClick={() => void remover(m)}>
                    Sim, remover
                  </Button>
                  <Button variant="ghost" onClick={() => setRemovendo(null)}>
                    Não
                  </Button>
                </div>
              )}
              {trocandoPin === m.user_id && (
                <NovoPin
                  onSalvar={async (pin) => {
                    const { error } = await supabase.rpc('definir_pin', {
                      p_restaurant_id: loja.id,
                      p_user_id: m.user_id,
                      p_pin: pin,
                      p_nome: m.nome.includes('@') ? m.nome.split('@')[0]! : m.nome,
                    });
                    if (error)
                      return error.code === '23505'
                        ? 'Este PIN já é de outra pessoa da equipe.'
                        : 'Não foi possível salvar o PIN.';
                    setTrocandoPin(null);
                    setAviso(`PIN de ${m.nome} salvo.`);
                    void carregar();
                    return null;
                  }}
                />
              )}
            </li>
          ))}
        </ul>
        <NovaPessoa
          souDono={souDono}
          onSalvar={async (dados) => {
            setErro('');
            const { error } = await supabase.functions.invoke('equipe-gestao', {
              body: { acao: 'adicionar', loja: loja.id, ...dados },
            });
            if (error) return mensagemDaFuncao(error);
            setAviso(`${dados.nome} entrou na equipe. O PIN dele já vale nos aparelhos da loja.`);
            void carregar();
            return null;
          }}
        />
      </Panel>

      <Panel title="Aparelhos da equipe">
        <p className="text-body text-ink-muted">
          O celular do garçom ou o tablet do caixa precisa ser conectado uma vez. Só aparelho
          conectado aceita PIN.
        </p>
        {aparelhos.length > 0 && (
          <ul className="flex flex-col divide-y divide-line">
            {aparelhos.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-body-strong text-ink">{a.name}</p>
                  <p className="text-caption text-ink-muted">
                    {a.last_used_at
                      ? `Último acesso ${tempoDesde(a.last_used_at, agora)}`
                      : 'Ainda não foi usado'}
                  </p>
                </div>
                <Button variant="ghost" className="text-danger" onClick={() => void desconectar(a)}>
                  Desconectar
                </Button>
              </li>
            ))}
          </ul>
        )}
        {codigo && restante > 0 ? (
          <div className="flex flex-col gap-3 rounded-md bg-surface-strong p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <span className="font-display text-display tracking-widest text-ink">
                {codigo.codigo}
              </span>
              <span className="text-caption text-ink-muted tabular-nums">
                vale por mais {Math.floor(restante / 60)}:{String(restante % 60).padStart(2, '0')}
              </span>
            </div>
            <ol className="flex list-decimal flex-col gap-2 pl-5 text-body text-ink">
              <li>
                No celular ou tablet, abra <strong>{window.location.host}/garcom</strong>.
              </li>
              <li>Toque em Conectar e digite este código.</li>
              <li>Pronto: a equipe entra com o PIN de cada um.</li>
            </ol>
            <Button variant="ghost" className="self-start px-0" onClick={() => setCodigo(null)}>
              Fechar
            </Button>
          </div>
        ) : (
          <Button variant="secondary" className="self-start" onClick={() => void gerarCodigo()}>
            Conectar um aparelho
          </Button>
        )}
      </Panel>
    </Tela>
  );
}

function NovoPin({ onSalvar }: { onSalvar: (pin: string) => Promise<string | null> }) {
  const [pin, setPin] = useState('');
  const [erro, setErro] = useState<string>();
  const [salvando, setSalvando] = useState(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setSalvando(true);
    setErro((await onSalvar(pin)) ?? undefined);
    setSalvando(false);
  }

  return (
    <form onSubmit={enviar} className="flex flex-wrap items-start gap-3">
      <TextField
        label="Novo PIN"
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        className="w-36"
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
        error={erro}
      />
      <Button
        type="submit"
        variant="secondary"
        className="mt-7"
        loading={salvando}
        disabled={pin.length !== 4}
      >
        Salvar PIN
      </Button>
    </form>
  );
}

function NovaPessoa({
  souDono,
  onSalvar,
}: {
  souDono: boolean;
  onSalvar: (dados: { nome: string; papel: Papel; pin: string }) => Promise<string | null>;
}) {
  const [nome, setNome] = useState('');
  const [papel, setPapel] = useState<Papel>('garcom');
  const [pin, setPin] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!nome.trim() || pin.length !== 4) return;
    setSalvando(true);
    const problema = await onSalvar({ nome: nome.trim(), papel, pin });
    setSalvando(false);
    if (problema) {
      setErro(problema);
      return;
    }
    setErro('');
    setNome('');
    setPin('');
  }

  const funcoes: { value: Papel; label: string }[] = [
    { value: 'garcom', label: 'Garçom' },
    { value: 'caixa', label: 'Caixa' },
    { value: 'cozinha', label: 'Cozinha' },
    { value: 'entregador', label: 'Entregador' },
    ...(souDono ? [{ value: 'gerente' as Papel, label: 'Gerente' }] : []),
  ];

  return (
    <form
      onSubmit={enviar}
      className="flex flex-col gap-4 rounded-md border border-line bg-canvas p-4"
    >
      <span className="text-body-strong text-ink">Adicionar pessoa</span>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
        <TextField
          label="Nome"
          placeholder="Como a equipe chama"
          maxLength={40}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
        <TextField
          label="PIN"
          inputMode="numeric"
          autoComplete="off"
          placeholder="4 números"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
        />
      </div>
      <ChoiceGrid label="Função" columns={3} options={funcoes} value={papel} onChange={setPapel} />
      <Alert>{erro}</Alert>
      <Button
        type="submit"
        className="self-start"
        loading={salvando}
        disabled={!nome.trim() || pin.length !== 4}
      >
        Adicionar à equipe
      </Button>
    </form>
  );
}
