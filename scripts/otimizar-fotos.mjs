// Converte as fotos de apps/web/fotos (PNG/JPG do GPT) em WebP leve para o site, em apps/web/public/fotos.
// Nome do arquivo = código da lista (A1-horizontal.png, B3.png, IG-1.jpg…); sai em minúsculas: a1-horizontal.webp.
// Horizontais até 1920 px de largura; verticais e quadradas até 1080 px. Foto que não existe: a página mostra o fundo escuro.
import { mkdir, readdir, stat } from 'node:fs/promises';
import { dirname, extname, join, parse } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const origem = join(raiz, 'apps/web/fotos');
const destino = join(raiz, 'apps/web/public/fotos');
const ACEITAS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

await mkdir(destino, { recursive: true });
const arquivos = (await readdir(origem).catch(() => [])).filter((f) =>
  ACEITAS.has(extname(f).toLowerCase()),
);
let feitas = 0;
for (const arquivo of arquivos) {
  const entrada = join(origem, arquivo);
  const saida = join(destino, `${parse(arquivo).name.toLowerCase()}.webp`);
  const [e, s] = await Promise.all([stat(entrada), stat(saida).catch(() => null)]);
  if (s && s.mtimeMs >= e.mtimeMs) continue; // já convertida
  const imagem = sharp(entrada);
  const { width = 0, height = 0 } = await imagem.metadata();
  const limite = width > height ? 1920 : 1080;
  await imagem
    .resize({ width: Math.min(width, limite), withoutEnlargement: true })
    .webp({ quality: 76, effort: 5 })
    .toFile(saida);
  feitas++;
}
console.log(`Fotos: ${arquivos.length} na pasta, ${feitas} convertidas agora.`);
