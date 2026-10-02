import { erroNaRegra, formatarPreco, lerPreco, regraDoGrupo } from '@usefood/core';
import type { AppSupabaseClient, Tables } from '@usefood/db';
import { Alert, Button, EmptyState, Panel, Switch, TextField } from '@usefood/ui';
import { useState, type FormEvent } from 'react';

export type Grupo = Pick<Tables<'modifier_groups'>, 'id' | 'name' | 'min_select' | 'max_select'>;
export type ItemAdicional = Pick<Tables<'modifiers'>, 'id' | 'group_id' | 'name' | 'price_cents'>;

/** Grupos de adicionais da loja (reaproveitados entre produtos) e os itens de cada um. */
export function Adicionais({
  supabase,
  lojaId,
  grupos,
  itens,
  podeEditar,
  onAlterado,
}: {
  supabase: AppSupabaseClient;
  lojaId: string;
  grupos: Grupo[];
  itens: ItemAdicional[];
  podeEditar: boolean;
  onAlterado: () => void;
}) {
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState('');
  const [apagandoGrupo, setApagandoGrupo] = useState<string | null>(null);

  async function criarGrupo(nome: string, minimo: number, maximo: number | null) {
    setErro('');
    const { error } = await supabase.from('modifier_groups').insert({
      restaurant_id: lojaId,
      name: nome,
      min_select: minimo,
      max_select: maximo,
      position: grupos.length,
    });
    if (error) {
      setErro('Não foi possível criar o grupo. Tente de novo.');
      return false;
    }
    setCriando(false);
    onAlterado();
    return true;
  }

  async function apagarGrupo(id: string) {
    setErro('');
    const { error } = await supabase.from('modifier_groups').delete().eq('id', id);
    setApagandoGrupo(null);
    if (error) setErro('Não foi possível excluir o grupo agora.');
    else onAlterado();
  }

  async function criarItem(grupoId: string, nome: string, precoCentavos: number) {
    setErro('');
    const { error } = await supabase.from('modifiers').insert({
      restaurant_id: lojaId,
      group_id: grupoId,
      name: nome,
      price_cents: precoCentavos,
      position: itens.filter((i) => i.group_id === grupoId).length,
    });
    if (error) {
      setErro('Não foi possível adicionar o item. Tente de novo.');
      return false;
    }
    onAlterado();
    return true;
  }

  async function apagarItem(id: string) {
    setErro('');
    const { error } = await supabase.from('modifiers').delete().eq('id', id);
    if (error) setErro('Não foi possível remover o item agora.');
    else onAlterado();
  }

  return (
    <div className="flex flex-col gap-6">
      <Alert>{erro}</Alert>

      {grupos.length === 0 && !criando && (
        <EmptyState
          title="Crie o primeiro grupo de adicionais"
          description="Grupos reúnem escolhas do cliente, como Adicionais (bacon, ovo, cheddar) ou Ponto da carne. Depois você liga cada grupo aos produtos que aceitam."
          action={podeEditar && <Button onClick={() => setCriando(true)}>Criar grupo</Button>}
        />
      )}

      {criando && <NovoGrupo onSalvar={criarGrupo} onCancelar={() => setCriando(false)} />}

      {grupos.map((g) => {
        const doGrupo = itens.filter((i) => i.group_id === g.id);
        return (
          <Panel
            key={g.id}
            id={`grupo-${g.id}`}
            title={g.name}
            actions={
              <span className="text-caption text-ink-muted">
                {regraDoGrupo(g.min_select, g.max_select)}
              </span>
            }
          >
            {doGrupo.length === 0 ? (
              <p className="text-caption text-ink-muted">Nenhum item ainda.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {doGrupo.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 py-2">
                    <span className="flex-1 text-body text-ink">{item.name}</span>
                    <span className="text-body text-ink-muted tabular-nums">
                      {item.price_cents > 0 ? `+ ${formatarPreco(item.price_cents)}` : 'Grátis'}
                    </span>
                    {podeEditar && (
                      <Button
                        variant="ghost"
                        aria-label={`Remover ${item.name}`}
                        onClick={() => void apagarItem(item.id)}
                      >
                        Remover
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {podeEditar && (
              <>
                <NovoItem onSalvar={(nome, preco) => criarItem(g.id, nome, preco)} />
                <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                  {apagandoGrupo === g.id ? (
                    <>
                      <span className="text-caption text-ink">
                        Excluir o grupo e os itens dele?
                      </span>
                      <Button variant="danger" onClick={() => void apagarGrupo(g.id)}>
                        Sim, excluir
                      </Button>
                      <Button variant="ghost" onClick={() => setApagandoGrupo(null)}>
                        Não
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="ghost"
                      className="px-0 text-danger"
                      onClick={() => setApagandoGrupo(g.id)}
                    >
                      Excluir grupo
                    </Button>
                  )}
                </div>
              </>
            )}
          </Panel>
        );
      })}

      {podeEditar && grupos.length > 0 && !criando && (
        <Button variant="secondary" className="self-start" onClick={() => setCriando(true)}>
          Novo grupo
        </Button>
      )}
    </div>
  );
}

function NovoGrupo({
  onSalvar,
  onCancelar,
}: {
  onSalvar: (nome: string, minimo: number, maximo: number | null) => Promise<boolean>;
  onCancelar: () => void;
}) {
  const [nome, setNome] = useState('');
  const [obrigatorio, setObrigatorio] = useState(false);
  const [maximo, setMaximo] = useState('');
  const [salvando, setSalvando] = useState(false);

  const minimo = obrigatorio ? 1 : 0;
  const maximoNumero = maximo.trim() === '' ? null : Number(maximo);
  const erroRegra = erroNaRegra(minimo, maximoNumero);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!nome.trim() || erroRegra) return;
    setSalvando(true);
    await onSalvar(nome.trim(), minimo, maximoNumero);
    setSalvando(false);
  }

  return (
    <form
      onSubmit={enviar}
      className="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5"
    >
      <TextField
        label="Nome do grupo"
        hint="Exemplos: Adicionais, Ponto da carne, Molhos"
        maxLength={60}
        required
        autoFocus
        value={nome}
        onChange={(e) => setNome(e.target.value)}
      />
      <Switch
        showLabel
        label="O cliente é obrigado a escolher"
        checked={obrigatorio}
        onChange={setObrigatorio}
      />
      <TextField
        label="Máximo de escolhas"
        inputMode="numeric"
        placeholder="Sem limite"
        value={maximo}
        onChange={(e) => setMaximo(e.target.value.replace(/\D/g, ''))}
        error={maximo ? (erroRegra ?? undefined) : undefined}
        hint={erroRegra ? undefined : regraDoGrupo(minimo, maximoNumero)}
      />
      <div className="flex gap-3">
        <Button type="submit" loading={salvando} disabled={!nome.trim() || !!erroRegra}>
          Criar grupo
        </Button>
        <Button variant="ghost" onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function NovoItem({
  onSalvar,
}: {
  onSalvar: (nome: string, precoCentavos: number) => Promise<boolean>;
}) {
  const [nome, setNome] = useState('');
  const [preco, setPreco] = useState('');
  const [salvando, setSalvando] = useState(false);

  const precoCentavos = preco.trim() === '' ? 0 : lerPreco(preco);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!nome.trim() || precoCentavos === null) return;
    setSalvando(true);
    if (await onSalvar(nome.trim(), precoCentavos)) {
      setNome('');
      setPreco('');
    }
    setSalvando(false);
  }

  return (
    <form onSubmit={enviar} className="grid grid-cols-[minmax(0,1fr)_7rem_auto] items-start gap-2">
      <TextField
        label="Novo item"
        maxLength={60}
        value={nome}
        onChange={(e) => setNome(e.target.value)}
      />
      <TextField
        label="Preço"
        inputMode="decimal"
        placeholder="Grátis"
        value={preco}
        onChange={(e) => setPreco(e.target.value)}
        error={precoCentavos === null ? 'Ex.: 3,00' : undefined}
      />
      <Button
        type="submit"
        variant="secondary"
        className="mt-7"
        loading={salvando}
        disabled={!nome.trim()}
      >
        Adicionar
      </Button>
    </form>
  );
}
