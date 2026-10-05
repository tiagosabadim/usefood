import { Tela, Titulo } from '@usefood/app';
import { checkStoreSlug, formatarPreco, slugify } from '@usefood/core';
import type { AppSupabaseClient, Database } from '@usefood/db';
import {
  Alert,
  Button,
  Panel,
  SegmentedControl,
  SelectField,
  Sheet,
  StatusPill,
  TextField,
  type StatusTone,
} from '@usefood/ui';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

type Loja = Database['public']['Functions']['console_lojas']['Returns'][number];
type Situacao = Loja['situacao'];

const SITUACAO: Record<Situacao, { texto: string; tom: StatusTone }> = {
  ativo: { texto: 'No ar', tom: 'sucesso' },
  rascunho: { texto: 'Em cadastro', tom: 'neutro' },
  pausado: { texto: 'Pausada', tom: 'destaque' },
  encerrado: { texto: 'Encerrada', tom: 'erro' },
};
const FILTROS = [
  { value: 'todas', label: 'Todas' },
  { value: 'ativo', label: 'No ar' },
  { value: 'rascunho', label: 'Em cadastro' },
  { value: 'pausado', label: 'Pausadas' },
  { value: 'encerrado', label: 'Encerradas' },
] as const;

const quando = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'nunca';

/** Todas as lojas da plataforma, com números de 30 dias, e o cadastro de loja para um dono. */
export function Lojas({ supabase, email }: { supabase: AppSupabaseClient; email: string }) {
  const [lojas, setLojas] = useState<Loja[] | null>(null);
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]['value']>('todas');
  const [busca, setBusca] = useState('');
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.rpc('console_lojas');
    if (error) setErro('Não conseguimos carregar as lojas.');
    else setLojas(data);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
  }, [carregar]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (lojas ?? []).filter(
      (l) =>
        (filtro === 'todas' || l.situacao === filtro) &&
        (!termo ||
          [l.nome, l.slug, l.cidade ?? '', ...l.donos].some((t) =>
            t.toLowerCase().includes(termo),
          )),
    );
  }, [lojas, filtro, busca]);

  const totais = useMemo(() => {
    const l = lojas ?? [];
    return {
      noAr: l.filter((x) => x.situacao === 'ativo').length,
      emCadastro: l.filter((x) => x.situacao === 'rascunho').length,
      pedidos: l.reduce((s, x) => s + x.pedidos_30d, 0),
      vendas: l.reduce((s, x) => s + Number(x.vendas_30d_cents), 0),
    };
  }, [lojas]);

  const acoes = (l: Loja) => (
    <div className="flex flex-wrap gap-2">
      {l.situacao === 'ativo' && (
        <>
          <a href={`/${l.slug}`} target="_blank" rel="noreferrer">
            <Button variant="secondary">Ver loja</Button>
          </a>
          <Button variant="ghost" onClick={() => void mudar(l, 'pausado')}>
            Pausar
          </Button>
        </>
      )}
      {l.situacao === 'pausado' && (
        <Button variant="secondary" onClick={() => void mudar(l, 'ativo')}>
          Reativar
        </Button>
      )}
      {l.situacao !== 'encerrado' && (
        <Button variant="ghost" className="text-danger" onClick={() => void mudar(l, 'encerrado')}>
          Encerrar
        </Button>
      )}
    </div>
  );

  async function mudar(loja: Loja, situacao: Situacao) {
    if (
      situacao === 'encerrado' &&
      !window.confirm(
        `Encerrar ${loja.nome}? A loja sai do ar e não aparece mais para os clientes.`,
      )
    )
      return;
    setErro('');
    const { error } = await supabase.rpc('console_mudar_situacao', {
      p_restaurant_id: loja.id,
      p_situacao: situacao,
    });
    if (error) return setErro(error.message);
    setAviso(`${loja.nome}: ${SITUACAO[situacao].texto.toLowerCase()}.`);
    await carregar();
  }

  return (
    <Tela larga>
      <Titulo
        titulo="Lojas"
        texto={`Todas as lojas da plataforma · ${email}`}
        acoes={
          <>
            <Button onClick={() => setCriando(true)}>Nova loja</Button>
            <Button
              variant="ghost"
              className="lg:hidden"
              onClick={() => void supabase.auth.signOut()}
            >
              Sair
            </Button>
          </>
        }
      />
      <Alert>{erro}</Alert>
      <Alert tone="sucesso">{aviso}</Alert>

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { titulo: 'Lojas no ar', valor: String(totais.noAr) },
          { titulo: 'Em cadastro', valor: String(totais.emCadastro) },
          { titulo: 'Pedidos (30 dias)', valor: totais.pedidos.toLocaleString('pt-BR') },
          { titulo: 'Vendas (30 dias)', valor: formatarPreco(totais.vendas) },
        ].map((c) => (
          <li
            key={c.titulo}
            className="flex flex-col gap-1 rounded-lg border border-line bg-surface p-4"
          >
            <span className="text-caption text-ink-muted">{c.titulo}</span>
            <span className="font-display text-title-section text-ink tabular-nums">{c.valor}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-end gap-3">
        <SegmentedControl
          label="Situação"
          className="flex-wrap"
          options={[...FILTROS]}
          value={filtro}
          onChange={setFiltro}
        />
        <TextField
          label="Buscar"
          placeholder="Loja, endereço, cidade ou e-mail"
          className="min-w-64 flex-1"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {!lojas ? (
        <p className="text-body text-ink-muted">Carregando as lojas…</p>
      ) : visiveis.length === 0 ? (
        <p className="text-body text-ink-muted">Nenhuma loja aqui.</p>
      ) : (
        <>
          <ul className="flex flex-col gap-3 lg:hidden">
            {visiveis.map((l) => (
              <li
                key={l.id}
                className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 md:flex-row md:items-center"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-body-strong text-ink">{l.nome}</span>
                    <StatusPill tone={SITUACAO[l.situacao].tom}>
                      {SITUACAO[l.situacao].texto}
                    </StatusPill>
                  </div>
                  <span className="text-caption text-ink-muted">
                    {l.marca} · /{l.slug}
                    {l.cidade ? ` · ${l.cidade}` : ''} · criada em{' '}
                    {new Date(l.criada_em).toLocaleDateString('pt-BR')}
                  </span>
                  <span className="text-caption text-ink-muted">
                    Dono: {l.donos.length ? l.donos.join(', ') : '—'}
                  </span>
                </div>
                <div className="flex flex-col text-caption text-ink-muted md:w-48">
                  <span className="text-body-strong text-ink tabular-nums">
                    {formatarPreco(Number(l.vendas_30d_cents))}
                  </span>
                  <span>
                    {l.pedidos_30d} pedidos em 30 dias · último {quando(l.ultimo_pedido_em)}
                  </span>
                </div>
                {acoes(l)}
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-lg border border-line lg:block">
            <table className="w-full text-left text-body">
              <thead className="bg-surface-strong text-label text-ink-muted">
                <tr>
                  <th className="px-4 py-3 font-normal">Loja</th>
                  <th className="px-4 py-3 font-normal">Situação</th>
                  <th className="px-4 py-3 font-normal">Dono</th>
                  <th className="px-4 py-3 text-right font-normal">Vendas 30 dias</th>
                  <th className="px-4 py-3 text-right font-normal">Pedidos</th>
                  <th className="px-4 py-3 font-normal">Último pedido</th>
                  <th className="px-4 py-3 font-normal">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-surface">
                {visiveis.map((l) => (
                  <tr key={l.id} className="align-middle">
                    <td className="px-4 py-3">
                      <span className="block text-body-strong text-ink">{l.nome}</span>
                      <span className="text-caption text-ink-muted">
                        {l.marca} · /{l.slug}
                        {l.cidade ? ` · ${l.cidade}` : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill tone={SITUACAO[l.situacao].tom}>
                        {SITUACAO[l.situacao].texto}
                      </StatusPill>
                    </td>
                    <td className="px-4 py-3 text-caption text-ink-muted">
                      {l.donos.join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-body-strong text-ink tabular-nums">
                      {formatarPreco(Number(l.vendas_30d_cents))}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{l.pedidos_30d}</td>
                    <td className="px-4 py-3 text-caption text-ink-muted">
                      {quando(l.ultimo_pedido_em)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">{acoes(l)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {criando && (
        <NovaLoja
          supabase={supabase}
          onFechar={() => setCriando(false)}
          onCriada={() => {
            void carregar();
          }}
        />
      )}
    </Tela>
  );
}

function NovaLoja({
  supabase,
  onFechar,
  onCriada,
}: {
  supabase: AppSupabaseClient;
  onFechar: () => void;
  onCriada: () => void;
}) {
  const [marcas, setMarcas] = useState<{ slug: string; name: string }[]>([]);
  const [marca, setMarca] = useState('usefood');
  const [nome, setNome] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEditado, setSlugEditado] = useState(false);
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [criada, setCriada] = useState<{
    nome: string;
    slug: string;
    email: string;
    contaNova: boolean;
  } | null>(null);

  useEffect(() => {
    void supabase
      .from('brands')
      .select('slug, name')
      .eq('status', 'ativa')
      .order('name')
      .then(({ data }) => {
        if (!data) return;
        setMarcas(data);
        if (data.length && !data.some((m) => m.slug === 'usefood')) setMarca(data[0]!.slug);
      });
  }, [supabase]);

  const endereco = slugEditado ? slug : slugify(nome);
  const checagem = endereco ? checkStoreSlug(endereco) : null;

  async function criar(evento: FormEvent) {
    evento.preventDefault();
    if (!checagem?.ok) return;
    setErro('');
    setEnviando(true);
    const { data, error } = await supabase.functions.invoke('console-lojas', {
      body: { acao: 'criar', marca, nome: nome.trim(), slug: endereco, email: email.trim() },
    });
    setEnviando(false);
    if (error || !data?.loja) {
      let mensagem = 'Não foi possível criar a loja.';
      try {
        const corpo = (await (error as { context?: Response })?.context?.json()) as
          { erro?: string } | undefined;
        if (corpo?.erro) mensagem = corpo.erro;
      } catch {
        // mantém a mensagem padrão
      }
      return setErro(mensagem);
    }
    setCriada({
      nome: nome.trim(),
      slug: endereco,
      email: email.trim().toLowerCase(),
      contaNova: Boolean(data.conta_nova),
    });
    onCriada();
  }

  const painel = `${window.location.origin}/pdv`;
  const mensagem = criada
    ? `Olá! A loja ${criada.nome} foi criada no usefood. Entre em ${painel} com o e-mail ${criada.email} e digite o código que vai chegar no seu e-mail. Lá você monta o cardápio e publica a loja online (${window.location.origin}/${criada.slug}).`
    : '';

  return (
    <Sheet open onClose={onFechar} title={criada ? 'Loja criada' : 'Nova loja'}>
      {criada ? (
        <div className="flex flex-col gap-4">
          <Alert tone="sucesso">
            {criada.nome} criada
            {criada.contaNova ? ' e conta do dono aberta' : ' para um dono que já tinha conta'}.
          </Alert>
          <Panel title="Mande para o dono">
            <p className="text-body text-ink">{mensagem}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => void navigator.clipboard.writeText(mensagem)}
              >
                Copiar mensagem
              </Button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(mensagem)}`}
                target="_blank"
                rel="noreferrer"
              >
                <Button variant="secondary">Enviar pelo WhatsApp</Button>
              </a>
            </div>
          </Panel>
          <Button onClick={onFechar}>Fechar</Button>
        </div>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={criar}>
          {marcas.length > 1 && (
            <SelectField
              label="Marca"
              options={marcas.map((m) => ({ value: m.slug, label: m.name }))}
              value={marca}
              onChange={setMarca}
            />
          )}
          <TextField
            label="Nome da loja"
            maxLength={60}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <TextField
            label="Endereço da loja"
            hint={checagem?.ok ? `${window.location.host}/${endereco}` : undefined}
            error={
              checagem && !checagem.ok
                ? checagem.reason === 'reservado'
                  ? 'Esse endereço é reservado; escolha outro.'
                  : 'Use letras minúsculas, números e hífen.'
                : undefined
            }
            value={endereco}
            onChange={(e) => {
              setSlugEditado(true);
              setSlug(e.target.value.toLowerCase());
            }}
          />
          <TextField
            label="E-mail do dono"
            type="email"
            autoComplete="off"
            hint="Ele entra no painel com esse e-mail e o código que chega nele."
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Alert>{erro}</Alert>
          <Button
            type="submit"
            loading={enviando}
            disabled={!nome.trim() || !checagem?.ok || !email.trim()}
          >
            Criar loja
          </Button>
        </form>
      )}
    </Sheet>
  );
}
