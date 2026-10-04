import { formatarPreco, lerPreco, precoParaCampo, regraDoGrupo } from '@usefood/core';
import type { AppSupabaseClient, Tables } from '@usefood/db';
import { Alert, Button, ChoiceGrid, PhotoField, Sheet, Switch, TextField } from '@usefood/ui';
import { useEffect, useState } from 'react';
import { apagarFoto, enviarFoto, urlDaFoto } from './foto';

export type ProdutoEditavel = Pick<
  Tables<'products'>,
  'id' | 'name' | 'description' | 'price_cents' | 'photo_path' | 'station_id'
>;
export type PracaResumo = Pick<Tables<'stations'>, 'id' | 'name'>;
export type GrupoResumo = Pick<
  Tables<'modifier_groups'>,
  'id' | 'name' | 'min_select' | 'max_select'
>;

interface Tamanho {
  chave: string;
  id?: string;
  nome: string;
  preco: string;
}

let contador = 0;
const novaChave = () => `novo-${++contador}`;

/** Edita tudo de um produto num painel lateral: foto, dados, tamanhos e adicionais. */
export function EditorProduto({
  supabase,
  lojaId,
  produto,
  grupos,
  pracas,
  onAlterado,
  onFechar,
}: {
  supabase: AppSupabaseClient;
  lojaId: string;
  produto: ProdutoEditavel;
  grupos: GrupoResumo[];
  /** Praças da loja; a primeira é a padrão. */
  pracas: PracaResumo[];
  /** Algo mudou no banco: a lista do cardápio deve recarregar. */
  onAlterado: () => void;
  onFechar: () => void;
}) {
  const [carregando, setCarregando] = useState(true);
  const [nome, setNome] = useState(produto.name);
  const [preco, setPreco] = useState(precoParaCampo(produto.price_cents));
  const [descricao, setDescricao] = useState(produto.description ?? '');
  // Sem praça definida, o produto sai na praça padrão (a primeira)
  const [pracaId, setPracaId] = useState<string | null>(
    produto.station_id ?? pracas[0]?.id ?? null,
  );
  const [fotoPath, setFotoPath] = useState(produto.photo_path);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [erroFoto, setErroFoto] = useState<string>();
  const [tamanhos, setTamanhos] = useState<Tamanho[]>([]);
  const [idsOriginais, setIdsOriginais] = useState<string[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [ligadosOriginais, setLigadosOriginais] = useState<Set<string>>(new Set());
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let ativo = true;
    void Promise.all([
      supabase
        .from('product_variants')
        .select('id, name, price_cents')
        .eq('product_id', produto.id)
        .order('position'),
      supabase.from('product_modifier_groups').select('group_id').eq('product_id', produto.id),
    ]).then(([variantes, ligacoes]) => {
      if (!ativo) return;
      if (variantes.error || ligacoes.error) {
        setErro('Não conseguimos carregar os tamanhos e adicionais deste produto.');
      } else {
        setTamanhos(
          variantes.data.map((v) => ({
            chave: v.id,
            id: v.id,
            nome: v.name,
            preco: precoParaCampo(v.price_cents),
          })),
        );
        setIdsOriginais(variantes.data.map((v) => v.id));
        const ligados = new Set(ligacoes.data.map((l) => l.group_id));
        setSelecionados(new Set(ligados));
        setLigadosOriginais(ligados);
      }
      setCarregando(false);
    });
    return () => {
      ativo = false;
    };
  }, [supabase, produto.id]);

  const precoCentavos = lerPreco(preco);
  const tamanhosValidos = tamanhos.every((t) => t.nome.trim() && lerPreco(t.preco) !== null);

  async function trocarFoto(arquivo: File) {
    setErroFoto(undefined);
    setEnviandoFoto(true);
    try {
      const caminho = await enviarFoto(supabase, lojaId, produto.id, arquivo);
      const { error } = await supabase
        .from('products')
        .update({ photo_path: caminho })
        .eq('id', produto.id);
      if (error) throw error;
      if (fotoPath) await apagarFoto(supabase, fotoPath);
      setFotoPath(caminho);
      onAlterado();
    } catch {
      setErroFoto('Não foi possível enviar a foto. Tente outra imagem ou confira a internet.');
    } finally {
      setEnviandoFoto(false);
    }
  }

  async function removerFoto() {
    if (!fotoPath) return;
    setErroFoto(undefined);
    const { error } = await supabase
      .from('products')
      .update({ photo_path: null })
      .eq('id', produto.id);
    if (error) {
      setErroFoto('Não foi possível remover a foto agora.');
      return;
    }
    await apagarFoto(supabase, fotoPath);
    setFotoPath(null);
    onAlterado();
  }

  async function salvar() {
    setTentou(true);
    if (!nome.trim() || precoCentavos === null || !tamanhosValidos) return;
    setErro('');
    setSalvando(true);
    try {
      const produtoAtualizado = await supabase
        .from('products')
        .update({
          name: nome.trim(),
          price_cents: precoCentavos,
          description: descricao.trim() || null,
          station_id: pracaId,
        })
        .eq('id', produto.id);
      if (produtoAtualizado.error) throw produtoAtualizado.error;

      // Tamanhos: apaga os que saíram, atualiza os que ficaram, cria os novos
      const ficaram = new Set(tamanhos.flatMap((t) => (t.id ? [t.id] : [])));
      const sairam = idsOriginais.filter((id) => !ficaram.has(id));
      if (sairam.length) {
        const { error } = await supabase.from('product_variants').delete().in('id', sairam);
        if (error) throw error;
      }
      for (const [posicao, t] of tamanhos.entries()) {
        const dados = {
          name: t.nome.trim(),
          price_cents: lerPreco(t.preco) ?? 0,
          position: posicao,
        };
        const { error } = t.id
          ? await supabase.from('product_variants').update(dados).eq('id', t.id)
          : await supabase
              .from('product_variants')
              .insert({ ...dados, restaurant_id: lojaId, product_id: produto.id });
        if (error) throw error;
      }

      // Adicionais: liga os novos, desliga os que saíram
      const ligar = [...selecionados].filter((g) => !ligadosOriginais.has(g));
      const desligar = [...ligadosOriginais].filter((g) => !selecionados.has(g));
      if (ligar.length) {
        const { error } = await supabase.from('product_modifier_groups').insert(
          ligar.map((g, i) => ({
            restaurant_id: lojaId,
            product_id: produto.id,
            group_id: g,
            position: i,
          })),
        );
        if (error) throw error;
      }
      if (desligar.length) {
        const { error } = await supabase
          .from('product_modifier_groups')
          .delete()
          .eq('product_id', produto.id)
          .in('group_id', desligar);
        if (error) throw error;
      }

      onAlterado();
      onFechar();
    } catch {
      setErro('Não foi possível salvar tudo. Confira a internet e tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    setErro('');
    setExcluindo(true);
    const { error } = await supabase.from('products').delete().eq('id', produto.id);
    setExcluindo(false);
    if (error) {
      setErro('Não foi possível excluir o produto agora.');
      return;
    }
    if (fotoPath) await apagarFoto(supabase, fotoPath);
    onAlterado();
    onFechar();
  }

  return (
    <Sheet
      open
      onClose={onFechar}
      title="Editar produto"
      footer={
        <div className="flex gap-3">
          <Button
            loading={salvando}
            disabled={carregando || excluindo}
            onClick={() => void salvar()}
          >
            Salvar produto
          </Button>
          <Button variant="ghost" onClick={onFechar}>
            Cancelar
          </Button>
        </div>
      }
    >
      <Alert>{erro}</Alert>

      <PhotoField
        label="Foto"
        imageUrl={urlDaFoto(supabase, fotoPath)}
        busy={enviandoFoto}
        error={erroFoto}
        onSelect={(arquivo) => void trocarFoto(arquivo)}
        onRemove={() => void removerFoto()}
      />

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
        <TextField
          label="Nome do produto"
          maxLength={80}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          error={tentou && !nome.trim() ? 'Dê um nome ao produto.' : undefined}
        />
        <TextField
          label="Preço"
          inputMode="decimal"
          value={preco}
          onChange={(e) => setPreco(e.target.value)}
          error={tentou && precoCentavos === null ? 'Ex.: 14,90' : undefined}
          hint={precoCentavos !== null ? formatarPreco(precoCentavos) : undefined}
        />
      </div>
      <TextField
        label="Descrição (opcional)"
        hint="O que vem no prato. Aparece para o cliente no cardápio."
        maxLength={500}
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
      />

      {pracas.length > 1 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-body-strong text-ink">Sai na impressora de</h3>
          <ChoiceGrid
            label="Praça do produto"
            columns={pracas.length >= 3 ? 3 : 2}
            options={pracas.map((p) => ({ value: p.id, label: p.name }))}
            value={pracaId}
            onChange={setPracaId}
          />
        </section>
      )}

      <section aria-labelledby="tamanhos-titulo" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h3 id="tamanhos-titulo" className="text-body-strong text-ink">
            Tamanhos
          </h3>
          <p className="text-caption text-ink-muted">
            Para quando o mesmo produto tem versões com preços diferentes, como Pequena e Grande.
          </p>
        </div>
        {tamanhos.map((t, i) => (
          <div key={t.chave} className="grid grid-cols-[minmax(0,1fr)_7rem_auto] items-start gap-2">
            <TextField
              label={`Tamanho ${i + 1}`}
              maxLength={40}
              value={t.nome}
              onChange={(e) =>
                setTamanhos((ts) =>
                  ts.map((x) => (x.chave === t.chave ? { ...x, nome: e.target.value } : x)),
                )
              }
              error={tentou && !t.nome.trim() ? 'Dê um nome.' : undefined}
            />
            <TextField
              label="Preço"
              inputMode="decimal"
              value={t.preco}
              onChange={(e) =>
                setTamanhos((ts) =>
                  ts.map((x) => (x.chave === t.chave ? { ...x, preco: e.target.value } : x)),
                )
              }
              error={tentou && lerPreco(t.preco) === null ? 'Ex.: 30,00' : undefined}
            />
            <Button
              variant="ghost"
              className="mt-7"
              aria-label={`Remover o tamanho ${t.nome || i + 1}`}
              onClick={() => setTamanhos((ts) => ts.filter((x) => x.chave !== t.chave))}
            >
              Remover
            </Button>
          </div>
        ))}
        <Button
          variant="ghost"
          className="self-start px-0 text-brand-text"
          disabled={carregando}
          onClick={() => setTamanhos((ts) => [...ts, { chave: novaChave(), nome: '', preco: '' }])}
        >
          + Adicionar tamanho
        </Button>
      </section>

      <section aria-labelledby="adicionais-titulo" className="flex flex-col gap-2">
        <h3 id="adicionais-titulo" className="text-body-strong text-ink">
          Adicionais deste produto
        </h3>
        {grupos.length === 0 ? (
          <p className="text-caption text-ink-muted">
            Crie grupos de adicionais na aba Adicionais do cardápio para usar aqui.
          </p>
        ) : (
          grupos.map((g) => (
            <Switch
              key={g.id}
              showLabel
              disabled={carregando}
              label={`${g.name} · ${regraDoGrupo(g.min_select, g.max_select)}`}
              checked={selecionados.has(g.id)}
              onChange={(ligado) =>
                setSelecionados((atual) => {
                  const proximo = new Set(atual);
                  if (ligado) proximo.add(g.id);
                  else proximo.delete(g.id);
                  return proximo;
                })
              }
            />
          ))
        )}
      </section>

      <section className="mt-2 flex flex-col items-start gap-3 border-t border-line pt-5">
        {confirmarExclusao ? (
          <>
            <p className="text-body text-ink">
              Excluir de vez? Pedidos antigos continuam mostrando o nome e o preço da época.
            </p>
            <div className="flex gap-2">
              <Button variant="danger" loading={excluindo} onClick={() => void excluir()}>
                Sim, excluir
              </Button>
              <Button variant="ghost" onClick={() => setConfirmarExclusao(false)}>
                Não
              </Button>
            </div>
          </>
        ) : (
          <Button
            variant="ghost"
            className="px-0 text-danger"
            onClick={() => setConfirmarExclusao(true)}
          >
            Excluir produto
          </Button>
        )}
      </section>
    </Sheet>
  );
}
