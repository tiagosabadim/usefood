import { useEffect } from 'react';

/** Telas de parede (cozinha, painel de chamada) ficam no tema escuro enquanto estão abertas. */
export function useTelaEscura(ativo = true): void {
  useEffect(() => {
    if (!ativo) return;
    const raiz = document.documentElement;
    const anterior = raiz.dataset.theme;
    raiz.dataset.theme = 'dark';
    return () => {
      if (anterior) raiz.dataset.theme = anterior;
      else delete raiz.dataset.theme;
    };
  }, [ativo]);
}

/** Bipe curto de dois tons (pedido novo, pedido pronto). */
export function tocarAviso(contexto: AudioContext): void {
  [880, 1175].forEach((frequencia, i) => {
    const oscilador = contexto.createOscillator();
    const volume = contexto.createGain();
    oscilador.frequency.value = frequencia;
    volume.gain.value = 0.15;
    oscilador.connect(volume).connect(contexto.destination);
    const inicio = contexto.currentTime + i * 0.18;
    oscilador.start(inicio);
    oscilador.stop(inicio + 0.14);
  });
}
