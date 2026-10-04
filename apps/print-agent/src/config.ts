import { readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface Configuracao {
  url: string;
  chave: string;
  email: string;
  senha: string;
  loja: string;
  nome: string;
}

/** Fica na pasta do usuário, legível só por ele. */
export const ARQUIVO =
  process.env.USEFOOD_IMPRESSAO_CONFIG ?? join(homedir(), '.usefood-impressao.json');

export async function lerConfiguracao(): Promise<Configuracao | null> {
  try {
    return JSON.parse(await readFile(ARQUIVO, 'utf8')) as Configuracao;
  } catch {
    return null;
  }
}

export async function salvarConfiguracao(c: Configuracao): Promise<void> {
  await writeFile(ARQUIVO, JSON.stringify(c, null, 2), { mode: 0o600 });
}
