import net from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { enviarParaImpressora } from './impressora';

let servidor: net.Server | undefined;
afterEach(() => servidor?.close());

/** Impressora de mentira: guarda tudo o que receber. */
function impressoraFalsa(): Promise<{ porta: number; recebido: Promise<Buffer> }> {
  return new Promise((pronto) => {
    let entregar: (b: Buffer) => void = () => undefined;
    const recebido = new Promise<Buffer>((r) => (entregar = r));
    servidor = net.createServer((socket) => {
      const partes: Buffer[] = [];
      socket.on('data', (d) => partes.push(d));
      socket.on('end', () => entregar(Buffer.concat(partes)));
    });
    servidor.listen(0, '127.0.0.1', () =>
      pronto({ porta: (servidor!.address() as net.AddressInfo).port, recebido }),
    );
  });
}

describe('enviarParaImpressora', () => {
  it('entrega os bytes exatos na impressora', async () => {
    const { porta, recebido } = await impressoraFalsa();
    const bytes = Uint8Array.from([0x1b, 0x40, 0x41, 0x0a]);
    await enviarParaImpressora('127.0.0.1', porta, bytes);
    expect([...(await recebido)]).toEqual([...bytes]);
  });

  it('impressora desligada vira uma mensagem clara', async () => {
    await expect(enviarParaImpressora('127.0.0.1', 1, Uint8Array.from([1]), 1000)).rejects.toThrow(
      /Não conectou na impressora 127\.0\.0\.1:1/,
    );
  });
});
