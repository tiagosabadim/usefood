import { StatusScreen, useAppContext } from '@usefood/app';
import { rotuloDoPapel, type Papel } from '@usefood/core';
import type { AppSupabaseClient, Session } from '@usefood/db';
import { Alert, Button, PinPad, TextField } from '@usefood/ui';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  esquecerAparelho,
  lerAparelho,
  lerErroDaFuncao,
  salvarAparelho,
  type Aparelho,
} from './aparelho';

function Moldura({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-8 px-5 py-8">
      {children}
    </main>
  );
}

export function App() {
  const { supabase } = useAppContext();
  if (!supabase)
    return <StatusScreen title="Comanda do garçom" description="Configure o banco no .env." />;
  return <ComAparelho supabase={supabase} />;
}

function ComAparelho({ supabase }: { supabase: AppSupabaseClient }) {
  const [aparelho, setAparelho] = useState<Aparelho | null>(() => lerAparelho());
  const [sessao, setSessao] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSessao(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, nova) => setSessao(nova));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  if (sessao === undefined) {
    return (
      <Moldura>
        <p className="text-body text-ink-muted">Abrindo…</p>
      </Moldura>
    );
  }
  if (sessao) return <Inicio supabase={supabase} sessao={sessao} aparelho={aparelho} />;
  if (!aparelho) return <Conectar supabase={supabase} onConectado={setAparelho} />;
  return (
    <Entrar
      supabase={supabase}
      aparelho={aparelho}
      onDesconectado={() => {
        esquecerAparelho();
        setAparelho(null);
      }}
    />
  );
}

/** Primeira vez: liga este aparelho à loja com o código que o gerente gerou em Equipe. */
function Conectar({
  supabase,
  onConectado,
}: {
  supabase: AppSupabaseClient;
  onConectado: (a: Aparelho) => void;
}) {
  const [codigo, setCodigo] = useState('');
  const [nome, setNome] = useState('Celular do salão');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function conectar(evento: FormEvent) {
    evento.preventDefault();
    setErro('');
    setEnviando(true);
    const { data, error } = await supabase.functions.invoke<{
      token: string;
      loja: string;
      restaurante: string;
    }>('equipe-acesso', {
      body: { acao: 'parear', codigo: codigo.trim(), nome: nome.trim() },
    });
    setEnviando(false);
    if (error || !data) {
      setErro((await lerErroDaFuncao(error)).mensagem);
      return;
    }
    salvarAparelho(data);
    onConectado(data);
  }

  return (
    <Moldura>
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-title-screen text-ink">Conectar este aparelho</h1>
        <p className="text-body text-ink-muted">
          Peça ao dono ou ao gerente o código de 8 letras, em Equipe, no painel da loja. Isso é
          feito uma vez só.
        </p>
      </header>
      <form className="flex flex-col gap-5" onSubmit={conectar}>
        <TextField
          label="Código"
          placeholder="K7QF-2M9X"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={9}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.toUpperCase())}
        />
        <TextField
          label="Nome deste aparelho"
          maxLength={60}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
        <Alert>{erro}</Alert>
        <Button
          type="submit"
          className="h-target-pdv"
          loading={enviando}
          disabled={codigo.replace(/[^A-Z0-9]/g, '').length !== 8}
        >
          Conectar
        </Button>
      </form>
    </Moldura>
  );
}

/** Tela de bloqueio: a pessoa digita o PIN dela. */
function Entrar({
  supabase,
  aparelho,
  onDesconectado,
}: {
  supabase: AppSupabaseClient;
  aparelho: Aparelho;
  onDesconectado: () => void;
}) {
  const [pin, setPin] = useState('');
  const [erro, setErro] = useState<string>();
  const [conferindo, setConferindo] = useState(false);
  const [desconectar, setDesconectar] = useState(false);

  async function entrar(digitado: string) {
    setErro(undefined);
    setConferindo(true);
    const { data, error } = await supabase.functions.invoke<{ token_hash: string }>(
      'equipe-acesso',
      {
        body: { acao: 'entrar', token: aparelho.token, pin: digitado },
      },
    );
    if (error || !data) {
      const problema = await lerErroDaFuncao(error);
      setConferindo(false);
      setPin('');
      if (problema.desconectado) {
        onDesconectado();
        return;
      }
      setErro(problema.mensagem);
      return;
    }
    const { error: erroSessao } = await supabase.auth.verifyOtp({
      token_hash: data.token_hash,
      type: 'magiclink',
    });
    setConferindo(false);
    setPin('');
    if (erroSessao) setErro('Não foi possível entrar agora. Tente de novo.');
  }

  return (
    <Moldura>
      <header className="flex flex-col items-center gap-1 text-center">
        <span className="font-display text-wordmark text-ink">{aparelho.loja}</span>
        <span className="text-caption text-ink-muted">Comanda da equipe</span>
      </header>
      <PinPad
        value={pin}
        onChange={setPin}
        onComplete={(p) => void entrar(p)}
        disabled={conferindo}
        error={erro}
      />
      <div className="mt-auto flex flex-col items-center gap-2">
        {desconectar ? (
          <>
            <p className="text-center text-caption text-ink-muted">
              O aparelho sai da loja. Para usar de novo, vai precisar de um código novo.
            </p>
            <div className="flex gap-2">
              <Button variant="danger" onClick={onDesconectado}>
                Desconectar
              </Button>
              <Button variant="ghost" onClick={() => setDesconectar(false)}>
                Cancelar
              </Button>
            </div>
          </>
        ) : (
          <Button variant="ghost" className="text-ink-muted" onClick={() => setDesconectar(true)}>
            Desconectar este aparelho
          </Button>
        )}
      </div>
    </Moldura>
  );
}

/** Depois do PIN. A comanda (Salão, mesa, rodadas) entra na próxima etapa. */
function Inicio({
  supabase,
  sessao,
  aparelho,
}: {
  supabase: AppSupabaseClient;
  sessao: Session;
  aparelho: Aparelho | null;
}) {
  const [quem, setQuem] = useState<{ nome: string; papel: Papel } | null>(null);

  useEffect(() => {
    const lojaId = aparelho?.restaurante;
    void Promise.all([
      supabase.from('memberships').select('role, restaurant_id').eq('user_id', sessao.user.id),
      supabase
        .from('staff_pins')
        .select('display_name, restaurant_id')
        .eq('user_id', sessao.user.id),
    ]).then(([vinculos, pins]) => {
      const vinculo =
        vinculos.data?.find((v) => !lojaId || v.restaurant_id === lojaId) ?? vinculos.data?.[0];
      const pin = pins.data?.find((p) => p.restaurant_id === vinculo?.restaurant_id);
      if (vinculo)
        setQuem({ nome: pin?.display_name ?? sessao.user.email ?? '', papel: vinculo.role });
    });
  }, [supabase, sessao, aparelho]);

  return (
    <Moldura>
      <header className="flex flex-col gap-1">
        <span className="text-caption text-ink-muted">{aparelho?.loja}</span>
        <h1 className="font-display text-title-screen text-ink">Olá, {quem?.nome ?? '…'}</h1>
        {quem && <span className="text-body text-ink-muted">{rotuloDoPapel(quem.papel)}</span>}
      </header>
      <Alert tone="info">
        A comanda chega na próxima atualização: Salão, mesas, rodadas e o aviso de pronto.
      </Alert>
      <Button
        variant="secondary"
        className="mt-auto h-target-pdv"
        onClick={() => void supabase.auth.signOut()}
      >
        Bloquear (trocar de pessoa)
      </Button>
    </Moldura>
  );
}
