import {
  deslocamentoAoMudarZoom,
  deslocamentoCentralizado,
  escalaDeCobertura,
  limitarDeslocamento,
  PROPORCAO_DA_FOTO,
  recorteNaImagem,
  type Deslocamento,
  type Recorte,
  type Tamanho,
} from '@usefood/core';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Button } from './button';

export interface ImageCropperProps {
  /** Endereço da imagem (pode ser um blob: do arquivo escolhido). */
  src: string;
  /** Proporção da moldura; o padrão das fotos de produto é 4:3. */
  aspect?: number;
  onConfirm: (recorte: Recorte) => void;
  onCancel: () => void;
  busy?: boolean;
}

const ZOOM_MAXIMO = 3;
const PASSO_DO_TECLADO = 10;

/**
 * Moldura para enquadrar a foto antes de salvar: arrastar move, o controle aumenta o zoom.
 * A foto sempre cobre a moldura inteira. Devolve o pedaço escolhido em pixels da imagem original.
 */
export function ImageCropper({
  src,
  aspect = PROPORCAO_DA_FOTO,
  onConfirm,
  onCancel,
  busy,
}: ImageCropperProps) {
  const molduraRef = useRef<HTMLDivElement>(null);
  const arrasto = useRef<{ px: number; py: number; inicio: Deslocamento } | null>(null);
  const [natural, setNatural] = useState<Tamanho | null>(null);
  const [moldura, setMoldura] = useState<Tamanho | null>(null);
  const [zoom, setZoom] = useState(1);
  const [desloc, setDesloc] = useState<Deslocamento>({ x: 0, y: 0 });
  const zoomId = useId();

  useEffect(() => {
    const el = molduraRef.current;
    if (!el) return;
    const observador = new ResizeObserver(([e]) => {
      if (e) setMoldura({ largura: e.contentRect.width, altura: e.contentRect.height });
    });
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  const base = natural && moldura ? escalaDeCobertura(natural, moldura) : 1;
  const escala = base * zoom;
  const naTela = natural
    ? { largura: natural.largura * escala, altura: natural.altura * escala }
    : null;

  // Foto nova ou moldura mudou de tamanho: recomeça centralizada, sem zoom
  useEffect(() => {
    if (!natural || !moldura) return;
    const b = escalaDeCobertura(natural, moldura);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setZoom(1);
    setDesloc(
      deslocamentoCentralizado(
        { largura: natural.largura * b, altura: natural.altura * b },
        moldura,
      ),
    );
  }, [natural, moldura]);

  function mover(d: Deslocamento) {
    if (naTela && moldura) setDesloc(limitarDeslocamento(d, naTela, moldura));
  }

  function aoPressionar(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    arrasto.current = { px: e.clientX, py: e.clientY, inicio: desloc };
  }
  function aoArrastar(e: PointerEvent<HTMLDivElement>) {
    const a = arrasto.current;
    if (a) mover({ x: a.inicio.x + e.clientX - a.px, y: a.inicio.y + e.clientY - a.py });
  }
  function aoSoltar() {
    arrasto.current = null;
  }
  function aoTeclar(e: KeyboardEvent<HTMLDivElement>) {
    const passos: Record<string, Deslocamento> = {
      ArrowLeft: { x: PASSO_DO_TECLADO, y: 0 },
      ArrowRight: { x: -PASSO_DO_TECLADO, y: 0 },
      ArrowUp: { x: 0, y: PASSO_DO_TECLADO },
      ArrowDown: { x: 0, y: -PASSO_DO_TECLADO },
    };
    const p = passos[e.key];
    if (!p) return;
    e.preventDefault();
    mover({ x: desloc.x + p.x, y: desloc.y + p.y });
  }
  function mudarZoom(novo: number) {
    if (!natural || !moldura) return;
    const novaEscala = base * novo;
    const d = deslocamentoAoMudarZoom(desloc, escala, novaEscala, moldura);
    setZoom(novo);
    setDesloc(
      limitarDeslocamento(
        d,
        { largura: natural.largura * novaEscala, altura: natural.altura * novaEscala },
        moldura,
      ),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={molduraRef}
        tabIndex={0}
        aria-label="Moldura da foto. Arraste para enquadrar; use as setas do teclado para mover."
        onPointerDown={aoPressionar}
        onPointerMove={aoArrastar}
        onPointerUp={aoSoltar}
        onPointerCancel={aoSoltar}
        onKeyDown={aoTeclar}
        className="relative w-full cursor-grab touch-none overflow-hidden rounded-lg bg-surface-strong select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:cursor-grabbing"
        style={{ aspectRatio: String(aspect) }}
      >
        <img
          src={src}
          alt=""
          draggable={false}
          onLoad={(e) =>
            setNatural({
              largura: e.currentTarget.naturalWidth,
              altura: e.currentTarget.naturalHeight,
            })
          }
          className="absolute"
          style={{
            left: desloc.x,
            top: desloc.y,
            width: naTela?.largura,
            height: naTela?.altura,
            maxWidth: 'none',
            visibility: naTela ? 'visible' : 'hidden',
          }}
        />
        {/* Linhas de terço, para ajudar a centralizar o prato */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3"
        >
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} className="border border-canvas/40" />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <label htmlFor={zoomId} className="text-label text-ink">
          Zoom
        </label>
        <input
          id={zoomId}
          type="range"
          min={1}
          max={ZOOM_MAXIMO}
          step={0.01}
          value={zoom}
          disabled={!naTela}
          onChange={(e) => mudarZoom(Number(e.target.value))}
          className="h-11 flex-1 accent-brand"
        />
      </div>
      <div className="flex gap-3">
        <Button
          loading={busy}
          disabled={!naTela || !moldura}
          onClick={() => moldura && onConfirm(recorteNaImagem(desloc, escala, moldura))}
        >
          Usar esta foto
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
