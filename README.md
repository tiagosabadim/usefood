# usefood

Plataforma para restaurantes: PDV, comanda, cozinha, cardápio QR, loja online, app de marketplace e marcas regionais, num só código.

Este repositório é a **E01 (base técnica)** do plano de entregas, com o início da **E03** (base multi-marca no banco).

## O que tem aqui

| Caminho         | O que é                                                                   |
| --------------- | ------------------------------------------------------------------------- |
| `apps/admin`    | PDV, caixa, cardápio e dashboard do restaurante (porta 5173)              |
| `apps/garcom`   | Comanda do garçom (porta 5174)                                            |
| `apps/web`      | App usefood, páginas das lojas e cardápio QR (porta 5175)                 |
| `apps/console`  | Painel master e painel do franqueado (porta 5176)                         |
| `packages/core` | Regras de negócio puras, com testes (marca por domínio, endereço da loja) |
| `packages/db`   | Cliente tipado do Supabase e tipos do banco                               |
| `packages/ui`   | Design system: tokens e componentes (tokens provisórios até a E02)        |
| `packages/app`  | Inicialização comum dos apps: marca, banco, monitoramento                 |
| `supabase/`     | Migrations, seed de desenvolvimento e testes de RLS (pgTAP)               |

## Rodar localmente

Requisitos: Node 22, pnpm 10 (`corepack enable`) e Docker (para o Supabase local).

```bash
pnpm install
cp .env.example .env
pnpm db:start          # sobe o Supabase local e mostra a URL e a chave publicável
# cole a URL e a chave publicável no .env
pnpm dev               # sobe os quatro apps
```

Endereços locais: `http://localhost:5175/` (vitrine), `http://localhost:5173/pdv/`, `http://localhost:5174/garcom/` e `http://localhost:5176/console/`.

O domínio decide o que abre, igual em produção (dados do seed):

- `http://localhost:5175/lanchoneteria` → loja dentro da vitrine usefood
- `http://guapifood.localhost:5175` → vitrine da guapifood
- `http://lanchoneteria.localhost:5175` → loja com domínio próprio, direto na loja

## Comandos

| Comando                                      | Faz                                                                  |
| -------------------------------------------- | -------------------------------------------------------------------- |
| `pnpm dev` / `pnpm dev:admin`                | Todos os apps, ou um só                                              |
| `pnpm build`                                 | Build de produção de todos os apps                                   |
| `pnpm lint` · `pnpm typecheck` · `pnpm test` | Qualidade, tipos e testes unitários                                  |
| `pnpm db:reset`                              | Recria o banco local do zero (migrations + seed)                     |
| `pnpm db:test`                               | Testes de RLS em `supabase/tests`                                    |
| `pnpm db:migration nome`                     | Cria uma migration nova                                              |
| `pnpm db:types`                              | Regenera `packages/db/src/database.types.ts` a partir do banco local |

## Ambientes

Três projetos no Supabase: **desenvolvimento** (local, via CLI), **homologação** e **produção**.

1. Crie os projetos de homologação e produção no Supabase.
2. No GitHub, crie os environments `homologacao` e `producao` (produção com aprovação obrigatória). Em cada um:
   - secrets `SUPABASE_ACCESS_TOKEN` e `SUPABASE_DB_PASSWORD`
   - variável `SUPABASE_PROJECT_REF`
3. Migrations entram em homologação a cada merge na `main`; produção roda pelo botão "Run workflow" do workflow **Migrations**.

## Deploy no Netlify

Um projeto só (`usefood`), que publica os quatro apps juntos pelo `netlify.toml` da raiz:

| Caminho         | App                        |
| --------------- | -------------------------- |
| `/` e `/[loja]` | vitrine e lojas            |
| `/pdv`          | PDV do restaurante         |
| `/garcom`       | comanda                    |
| `/console`      | painel master e franqueado |

No Netlify: ligue o projeto a este repositório e deixe **Base directory** e **Package directory** vazios. Variáveis: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_APP_ENV` e, se usar, `VITE_SENTRY_DSN`. Até o lançamento, todos os contextos apontam para o Supabase de homologação.

Cada pull request gera um preview automático do site inteiro.

## Domínios próprios (marcas e lojas)

O mesmo site responde por todos os domínios. Ao abrir, o app consulta `resolver_dominio` no banco:

- domínio de **marca** (guapifood.com.br) → vitrine daquela marca;
- domínio de **loja** (ranchopasteis.com.br) → direto na loja;
- domínio não cadastrado → vitrine usefood.

A Edge Function `supabase/functions/dominios` conecta o domínio sozinha: confere a permissão, registra o domínio e o `www` no provedor, devolve os registros DNS para o cliente configurar e, quando o DNS aponta, ativa o domínio e pede o SSL. Segredos da função (Supabase → Edge Functions → Secrets):

| Segredo              | Valor                                                   |
| -------------------- | ------------------------------------------------------- |
| `NETLIFY_AUTH_TOKEN` | token pessoal do Netlify (User settings → Applications) |
| `NETLIFY_SITE_ID`    | id do projeto `usefood` no Netlify                      |
| `NETLIFY_SITE_HOST`  | `usefood.netlify.app`                                   |

**Limite atual:** o Netlify recomenda até 50 nomes por site, e cada domínio ocupa dois (com e sem www). Ao chegar perto disso, a função recusa novos domínios com uma mensagem clara. Esse é o sinal para trocar de provedor: escreva outro adaptador em `provedor.ts` (Cloudflare for SaaS, por exemplo) e mude `DOMINIOS_PROVEDOR`. Cada domínio guarda o provedor que o conectou, então a troca pode ser gradual.

## Banco: o que já existe

- **Marcas** (`brands`, `domains`, `territories`, `brand_members`) e **lojas** (`organizations`, `restaurants`, `memberships`), com RLS em todas as tabelas.
- Uma loja nunca enxerga dados de outra; o franqueado vê as lojas da sua marca; visitantes veem só lojas ativas. Os testes em `supabase/tests/rls_isolamento.test.sql` provam isso.
- `criar_restaurante(marca, nome, endereço)` cria organização, loja e o vínculo de dono numa transação, recusando endereços reservados.

Para virar admin da plataforma no banco local, depois de criar seu usuário no Studio (`http://127.0.0.1:54323`):

```sql
insert into public.platform_admins (user_id)
select id from auth.users where email = 'seu@email.com';
```

## Decisões em aberto que afetam este código

- Framework do `apps/web` com renderização no servidor (hoje é SPA com Vite).
- Tokens visuais definitivos (E02), que substituem os valores de `packages/ui/src/theme.css`.
