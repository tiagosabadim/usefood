import { formatarPreco, lerPreco, precoParaCampo, regraDoGrupo, type Recorte } from '@usefood/core';
import type { AppSupabaseClient, Tables } from '@usefood/db';
import {
  Alert,
  Button,
  ChoiceGrid,
  ImageCropper,
  PhotoField,
  QuantityStepper,
  SegmentedControl,
  SelectField,
  Sheet,
  Switch,
  TextField,
} from '@usefood/ui';
import { useEffect, useState } from 'react';
import { apagarFoto, baixarFoto, enviarFoto, urlDaFoto } from './foto';

export type ProdutoEditavel = Pick<
  Tables<'products'>,
  | 'id'
  | 'name'
  | 'description'
  | 'price_cents'
  | 'photo_path'
  | 'station_id'
  | 'promo_price_cents'
  | 'promo_ends_at'
  | 'category_id'
  | 'is_featured'
  | 'is_combo'
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
  categorias,
  produtosDaLoja,
  onAlterado,
  onFechar,
}: {
  supabase: AppSupabaseClient;
  lojaId: string;
  /** Produto sem id: criar (tudo de uma vez). Com id: editar. */
  produto: ProdutoEditavel;
  /** Categorias do cardápio para escolher (subcategorias como "Lanches › Artesanais"). */
  categorias: { id: string; nome: string }[];
  /** Produtos da loja que podem entrar num combo (os que não são combo). */
  produtosDaLoja: { id: string; nome: string }[];
  grupos: GrupoResumo[];
  /** Praças da loja; a primeira é a padrão. */
  pracas: PracaResumo[];
  /** Algo mudou no banco: a lista do cardápio deve recarregar. */
  onAlterado: () => void;
  onFechar: () => void;
}) {
  const novo = !produto.id;
  const [carregando, setCarregando] = useState(!novo);
  const [categoriaId, setCategoriaId] = useState(produto.category_id);
  const [destaque, setDestaque] = useState(produto.is_featured);
  const [ehCombo, setEhCombo] = useState(produto.is_combo);
  const [itensDoCombo, setItensDoCombo] = useState<
    { chave: string; itemId: string; quantidade: number }[]
  >([]);
  // Criar: a foto enquadrada fica guardada e sobe junto com o produto ao salvar
  const [fotoPendente, setFotoPendente] = useState<{
    fonte: Blob;
    recorte: Recorte;
    previa: string;
  } | null>(null);
  const [nome, setNome] = useState(produto.name);
  const [preco, setPreco] = useState(produto.id ? precoParaCampo(produto.price_cents) : '');
  // Promoção: preço menor (opcional) e até quando vale (opcional, fim do dia)
  const [promo, setPromo] = useState(
    produto.promo_price_cents ? precoParaCampo(produto.promo_price_cents) : '',
  );
  const [promoAte, setPromoAte] = useState(
    produto.promo_ends_at ? produto.promo_ends_at.slice(0, 10) : '',
  );
  const [descricao, setDescricao] = useState(produto.description ?? '');
  // Sem praça definida, o produto sai na praça padrão (a primeira)
  const [pracaId, setPracaId] = useState<string | null>(
    produto.station_id ?? pracas[0]?.id ?? null,
  );
  const [fotoPath, setFotoPath] = useState(produto.photo_path);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [erroFoto, setErroFoto] = useState<string>();
  // Foto escolhida (ou a atual, para reajustar) esperando o enquadramento 4:3
  const [enquadrando, setEnquadrando] = useState<{ src: string; fonte: Blob } | null>(null);
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
    if (!produto.id) return;
    let ativo = true;
    void Promise.all([
      supabase
        .from('product_variants')
        .select('id, name, price_cents')
        .eq('product_id', produto.id)
        .order('position'),
      supabase.from('product_modifier_groups').select('group_id').eq('product_id', produto.id),
      supabase
        .from('product_combo_items')
        .select('item_id, quantity')
        .eq('combo_id', produto.id)
        .order('position'),
    ]).then(([variantes, ligacoes, combo]) => {
      if (ativo && combo.data) {
        setItensDoCombo(
          combo.data.map((c) => ({ chave: c.item_id, itemId: c.item_id, quantidade: c.quantity })),
        );
      }
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
  const promoCentavos = promo.trim() ? lerPreco(promo) : null;
  const promoInvalida =
    Boolean(promo.trim()) &&
    (promoCentavos === null || (precoCentavos !== null && promoCentavos >= precoCentavos));
  const comboInvalido =
    ehCombo && (itensDoCombo.length === 0 || itensDoCombo.some((i) => !i.itemId));
  const tamanhosValidos = tamanhos.every((t) => t.nome.trim() && lerPreco(t.preco) !== null);

  function enquadrar(fonte: Blob) {
    setErroFoto(undefined);
    setEnquadrando({ src: URL.createObjectURL(fonte), fonte });
  }

  function pararDeEnquadrar() {
    if (enquadrando) URL.revokeObjectURL(enquadrando.src);
    setEnquadrando(null);
  }

  async function reenquadrarAtual() {
    const url = urlDaFoto(supabase, fotoPath);
    if (!url) return;
    try {
      enquadrar(await baixarFoto(url));
    } catch {
      setErroFoto('Não foi possível abrir a foto atual. Escolha a foto de novo.');
    }
  }

  async function salvarFoto(recorte: Recorte) {
    if (!enquadrando) return;
    if (novo) {
      setFotoPendente({
        fonte: enquadrando.fonte,
        recorte,
        previa: URL.createObjectURL(enquadrando.fonte),
      });
      pararDeEnquadrar();
      return;
    }
    setErroFoto(undefined);
    setEnviandoFoto(true);
    try {
      const caminho = await enviarFoto(supabase, lojaId, produto.id, enquadrando.fonte, recorte);
      const { error } = await supabase
        .from('products')
        .update({ photo_path: caminho })
        .eq('id', produto.id);
      if (error) throw error;
      if (fotoPath) await apagarFoto(supabase, fotoPath);
      setFotoPath(caminho);
      pararDeEnquadrar();
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
    if (
      !nome.trim() ||
      precoCentavos === null ||
      !tamanhosValidos ||
      promoInvalida ||
      comboInvalido
    )
      return;
    setErro('');
    setSalvando(true);
    try {
      const dados = {
        name: nome.trim(),
        price_cents: precoCentavos,
        promo_price_cents: tamanhos.length ? null : promoCentavos,
        promo_ends_at:
          tamanhos.length || !promoCentavos || !promoAte ? null : `${promoAte}T23:59:59-03:00`,
        description: descricao.trim() || null,
        station_id: pracaId,
        category_id: categoriaId,
        is_featured: destaque,
        is_combo: ehCombo,
      };
      let id = produto.id;
      if (novo) {
        const criado = await supabase
          .from('products')
          .insert({ ...dados, restaurant_id: lojaId })
          .select('id')
          .single();
        if (criado.error) throw criado.error;
        id = criado.data.id;
        if (fotoPendente) {
          const caminho = await enviarFoto(
            supabase,
            lojaId,
            id,
            fotoPendente.fonte,
            fotoPendente.recorte,
          );
          const comFoto = await supabase
            .from('products')
            .update({ photo_path: caminho })
            .eq('id', id);
          if (comFoto.error) throw comFoto.error;
        }
      } else {
        const atualizado = await supabase.from('products').update(dados).eq('id', id);
        if (atualizado.error) throw atualizado.error;
      }

      // Itens do combo: apaga e grava de novo na ordem da tela
      if (!novo) {
        const limpou = await supabase.from('product_combo_items').delete().eq('combo_id', id);
        if (limpou.error) throw limpou.error;
      }
      if (ehCombo && itensDoCombo.length) {
        const gravou = await supabase.from('product_combo_items').insert(
          itensDoCombo.map((i, posicao) => ({
            restaurant_id: lojaId,
            combo_id: id,
            item_id: i.itemId,
            quantity: i.quantidade,
            position: posicao,
          })),
        );
        if (gravou.error) throw gravou.error;
      }

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
              .insert({ ...dados, restaurant_id: lojaId, product_id: id });
        if (error) throw error;
      }

      // Adicionais: liga os novos, desliga os que saíram
      const ligar = [...selecionados].filter((g) => !ligadosOriginais.has(g));
      const desligar = [...ligadosOriginais].filter((g) => !selecionados.has(g));
      if (ligar.length) {
        const { error } = await supabase.from('product_modifier_groups').insert(
          ligar.map((g, i) => ({
            restaurant_id: lojaId,
            product_id: id,
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
          .eq('product_id', id)
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
      setErro(
        error.code === '23503'
          ? 'Este produto está num combo. Tire ele do combo antes de excluir (ou pause o produto).'
          : 'Não foi possível excluir o produto agora.',
      );
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
      title={novo ? 'Novo produto' : 'Editar produto'}
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

      {enquadrando ? (
        <section className="flex flex-col gap-2">
          <h3 className="text-body-strong text-ink">Enquadre a foto</h3>
          <p className="text-caption text-ink-muted">
            Arraste e use o zoom. Todas as fotos do cardápio ficam neste mesmo formato.
          </p>
          <ImageCropper
            src={enquadrando.src}
            busy={enviandoFoto}
            onCancel={pararDeEnquadrar}
            onConfirm={(r) => void salvarFoto(r)}
          />
          {erroFoto && <p className="text-caption text-danger">{erroFoto}</p>}
        </section>
      ) : (
        <>
          <SegmentedControl
            label="Tipo"
            className="self-start"
            options={[
              { value: 'produto', label: 'Produto' },
              { value: 'combo', label: 'Combo' },
            ]}
            value={ehCombo ? 'combo' : 'produto'}
            onChange={(v) => setEhCombo(v === 'combo')}
          />
          <PhotoField
            label="Foto"
            imageUrl={fotoPendente?.previa ?? urlDaFoto(supabase, fotoPath)}
            busy={enviandoFoto}
            error={erroFoto}
            onSelect={enquadrar}
            onAdjust={() => void reenquadrarAtual()}
            onRemove={() => void removerFoto()}
          />
        </>
      )}

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
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Preço promocional (opcional)"
          inputMode="decimal"
          placeholder="Ex.: 24,90"
          value={promo}
          disabled={tamanhos.length > 0}
          onChange={(e) => setPromo(e.target.value)}
          error={tentou && promoInvalida ? 'Precisa ser menor que o preço.' : undefined}
          hint={
            tamanhos.length > 0
              ? 'Produto com tamanhos: vale o preço de cada tamanho.'
              : promoCentavos !== null
                ? `Aparece em Ofertas no app, com ${formatarPreco(precoCentavos ?? 0)} riscado.`
                : 'Deixe vazio para não ter promoção.'
          }
        />
        <TextField
          label="Promoção até (opcional)"
          type="date"
          value={promoAte}
          disabled={tamanhos.length > 0 || !promo.trim()}
          onChange={(e) => setPromoAte(e.target.value)}
          hint="Sem data, a promoção vale até você tirar."
        />
      </div>
      <TextField
        label="Descrição (opcional)"
        hint="O que vem no prato. Aparece para o cliente no cardápio."
        maxLength={500}
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Categoria"
          hint="A categoria do cardápio (e a do app, ligada a ela)."
          options={categorias.map((c) => ({ value: c.id, label: c.nome }))}
          value={categoriaId}
          onChange={setCategoriaId}
        />
        <div className="flex flex-col gap-2">
          <Switch label="Destaque" showLabel checked={destaque} onChange={setDestaque} />
          <p className="text-caption text-ink-muted">
            Aparece em Destaques na loja e primeiro na categoria do app.
          </p>
        </div>
      </div>

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

      {ehCombo && (
        <section aria-labelledby="combo-titulo" className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h3 id="combo-titulo" className="text-body-strong text-ink">
              Itens do combo
            </h3>
            <p className="text-caption text-ink-muted">
              O que vai no combo. Sai na cozinha e no ticket como "Inclui: 1× X-Burguer, 1× Batata".
            </p>
          </div>
          {itensDoCombo.map((item) => (
            <div key={item.chave} className="flex flex-wrap items-end gap-3">
              <SelectField
                label="Produto"
                className="min-w-48 flex-1"
                options={[
                  { value: '', label: 'Escolha' },
                  ...produtosDaLoja
                    .filter((p) => p.id !== produto.id)
                    .map((p) => ({ value: p.id, label: p.nome })),
                ]}
                value={item.itemId}
                onChange={(v) =>
                  setItensDoCombo((is) =>
                    is.map((x) => (x.chave === item.chave ? { ...x, itemId: v } : x)),
                  )
                }
              />
              <QuantityStepper
                value={item.quantidade}
                itemName="item do combo"
                onDecrement={() =>
                  setItensDoCombo((is) =>
                    is.map((x) =>
                      x.chave === item.chave
                        ? { ...x, quantidade: Math.max(1, x.quantidade - 1) }
                        : x,
                    ),
                  )
                }
                onIncrement={() =>
                  setItensDoCombo((is) =>
                    is.map((x) =>
                      x.chave === item.chave
                        ? { ...x, quantidade: Math.min(20, x.quantidade + 1) }
                        : x,
                    ),
                  )
                }
              />
              <Button
                variant="ghost"
                className="text-danger"
                onClick={() => setItensDoCombo((is) => is.filter((x) => x.chave !== item.chave))}
              >
                Tirar
              </Button>
            </div>
          ))}
          {tentou && comboInvalido && (
            <p className="text-caption text-danger">Escolha pelo menos um produto para o combo.</p>
          )}
          <Button
            variant="ghost"
            className="self-start px-0 text-brand-text"
            disabled={carregando}
            onClick={() =>
              setItensDoCombo((is) => [...is, { chave: novaChave(), itemId: '', quantidade: 1 }])
            }
          >
            + Adicionar item ao combo
          </Button>
        </section>
      )}

      {!ehCombo && (
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
            <div
              key={t.chave}
              className="grid grid-cols-[minmax(0,1fr)_7rem_auto] items-start gap-2"
            >
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
            onClick={() =>
              setTamanhos((ts) => [...ts, { chave: novaChave(), nome: '', preco: '' }])
            }
          >
            + Adicionar tamanho
          </Button>
        </section>
      )}

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

      {!novo && (
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
      )}
    </Sheet>
  );
}
