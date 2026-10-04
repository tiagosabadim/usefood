import { useEffect, useState } from 'react';

/** Hora atual que avança sozinha, para "aberta há 12 min" e "pronto agora". */
export function useAgora(intervaloMs = 30_000): number {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), intervaloMs);
    return () => clearInterval(t);
  }, [intervaloMs]);
  return agora;
}
