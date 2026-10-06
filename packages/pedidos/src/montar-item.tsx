import { formatarPreco, problemaNaEscolha, type NovoItem } from '@usefood/core';
import { Button, ChoiceGrid, Chip, QuantityStepper, Sheet, TextField } from '@usefood/ui';
import { useState } from 'react';
import type { GrupoDeOpcoes, OpcaoTamanho } from './cardapio';

const comPreco = (nome: string, centavos: number) =>
  centavos > 0 ? `${nome} +${formatarPreco(centavos)}` : nome;

/** Painel do PDV para escolher tamanho, adicionais e observação antes de pôr no pedido. */
export function MontarItem({
  produto,
  tamanhos,
  grupos,
  fotoUrl,
  rotuloDoBotao = 'Adicionar',
  onAdicionar,
  onFechar,
}: {
  produto: { id: string; name: string; price_cents: number; description?: string | null };
  fotoUrl?: string | null;
  /** Texto do botão (loja online: "Adicionar ao carrinho"). */
  rotuloDoBotao?: string;
  tamanhos: OpcaoTamanho[];
  grupos: GrupoDeOpcoes[];
  onAdicionar: (item: NovoItem) => void;
  onFechar: () => void;
}) {
  const [tamanhoId, setTamanhoId] = useState<string | null>(
    tamanhos.length === 1 ? tamanhos[0]!.id : null,
  );
  const [escolhidos, setEscolhidos] = useState<Set<string>>(new Set());
  const [observacao, setObservacao] = useState('');
  const [quantidade, setQuantidade] = useState(1);
  const [tentou, setTentou] = useState(false);

  const tamanho = tamanhos.find((t) => t.id === tamanhoId) ?? null;
  const adicionais = grupos.flatMap((g) => g.itens).filter((i) => escolhidos.has(i.id));
  const unitario =
    (tamanho?.precoCentavos ?? produto.price_cents) +
    adicionais.reduce((s, a) => s + a.precoCentavos, 0);
  const porGrupo = Object.fromEntries(
    grupos.map((g) => [g.id, g.itens.filter((i) => escolhidos.has(i.id)).length]),
  );
  const problema =
    tamanhos.length > 0 && !tamanho
      ? 'Escolha o tamanho.'
      : problemaNaEscolha(
          grupos.map((g) => ({ id: g.id, nome: g.nome, minimo: g.minimo, maximo: g.maximo })),
          porGrupo,
        );

  function alternar(grupo: GrupoDeOpcoes, itemId: string) {
    setEscolhidos((atual) => {
      const proximo = new Set(atual);
      if (grupo.maximo === 1) {
        // Escolha única: troca a opção do grupo; tocar de novo desmarca se o grupo não é obrigatório
        const jaEra = proximo.has(itemId);
        grupo.itens.forEach((i) => proximo.delete(i.id));
        if (!jaEra || grupo.minimo > 0) proximo.add(itemId);
      } else if (proximo.has(itemId)) {
        proximo.delete(itemId);
      } else {
        proximo.add(itemId);
      }
      return proximo;
    });
  }

  function adicionar() {
    setTentou(true);
    if (problema) return;
    onAdicionar({
      productId: produto.id,
      nome: produto.name,
      precoCentavos: unitario,
      quantidade,
      tamanhoId: tamanho?.id ?? null,
      tamanhoNome: tamanho?.nome ?? null,
      adicionais: adicionais.map((a) => ({
        id: a.id,
        nome: a.nome,
        precoCentavos: a.precoCentavos,
      })),
      observacao,
      paraViagem: false,
    });
  }

  return (
    <Sheet
      open
      onClose={onFechar}
      title={produto.name}
      footer={
        <div className="flex flex-col gap-3">
          {tentou && problema && <p className="text-caption text-danger">{problema}</p>}
          <div className="flex items-center justify-between gap-4">
            <QuantityStepper
              value={quantidade}
              itemName={produto.name}
              onDecrement={() => setQuantidade((q) => Math.max(1, q - 1))}
              onIncrement={() => setQuantidade((q) => Math.min(999, q + 1))}
            />
            <Button className="h-target-pdv flex-1" onClick={adicionar}>
              {rotuloDoBotao} · {formatarPreco(unitario * quantidade)}
            </Button>
          </div>
        </div>
      }
    >
      {fotoUrl && (
        <img src={fotoUrl} alt="" className="aspect-[4/3] w-full rounded-lg object-cover" />
      )}
      {produto.description && <p className="text-body text-ink-muted">{produto.description}</p>}

      {tamanhos.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-body-strong text-ink">Tamanho</h3>
          <ChoiceGrid
            label="Tamanho"
            options={tamanhos.map((t) => ({
              value: t.id,
              label: `${t.nome} · ${formatarPreco(t.precoCentavos)}`,
            }))}
            value={tamanhoId}
            onChange={setTamanhoId}
          />
        </section>
      )}

      {grupos.map((g) => {
        const cheio = g.maximo !== null && (porGrupo[g.id] ?? 0) >= g.maximo;
        return (
          <section key={g.id} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-body-strong text-ink">{g.nome}</h3>
              <span className="text-caption text-ink-muted">
                {g.minimo > 0
                  ? g.maximo === g.minimo
                    ? `Obrigatório, escolha ${g.minimo}`
                    : `Escolha pelo menos ${g.minimo}`
                  : g.maximo === null
                    ? 'Opcional'
                    : `Opcional, até ${g.maximo}`}
              </span>
            </div>
            {g.maximo === 1 ? (
              <ChoiceGrid
                label={g.nome}
                options={g.itens.map((i) => ({
                  value: i.id,
                  label: comPreco(i.nome, i.precoCentavos),
                }))}
                value={g.itens.find((i) => escolhidos.has(i.id))?.id ?? null}
                onChange={(id) => alternar(g, id)}
              />
            ) : (
              <div className="flex flex-wrap gap-2" role="group" aria-label={g.nome}>
                {g.itens.map((i) => (
                  <Chip
                    key={i.id}
                    selected={escolhidos.has(i.id)}
                    disabled={cheio && !escolhidos.has(i.id)}
                    onClick={() => alternar(g, i.id)}
                    className="disabled:opacity-50"
                  >
                    {comPreco(i.nome, i.precoCentavos)}
                  </Chip>
                ))}
              </div>
            )}
          </section>
        );
      })}

      <TextField
        label="Observação (opcional)"
        placeholder="Ex.: sem cebola"
        maxLength={200}
        value={observacao}
        onChange={(e) => setObservacao(e.target.value)}
      />
    </Sheet>
  );
}
