import net from 'node:net';

/** Manda os bytes ESC/POS para a impressora de rede (porta 9100) e espera a entrega. */
export function enviarParaImpressora(
  host: string,
  port: number,
  bytes: Uint8Array,
  timeoutMs = 5000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let terminou = false;
    const socket = net.createConnection({ host, port });
    const falhar = (motivo: string) => {
      if (terminou) return;
      terminou = true;
      socket.destroy();
      reject(new Error(motivo));
    };
    socket.setTimeout(timeoutMs, () => falhar(`A impressora ${host}:${port} não respondeu.`));
    socket.once('error', (e) =>
      falhar(`Não conectou na impressora ${host}:${port} (${e.message}).`),
    );
    socket.once('connect', () => {
      socket.end(Buffer.from(bytes), () => {
        if (terminou) return;
        terminou = true;
        resolve();
      });
    });
  });
}
