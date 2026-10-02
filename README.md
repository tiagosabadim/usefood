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

## Login (E03)

O `/pdv` entra sem senha: a pessoa digita o e-mail, recebe um código de 6 números e digita o código. A conta é criada no primeiro acesso, e em seguida ela cria a loja (nome e endereço).

- **Local:** os e-mails não saem do computador; veja-os no Mailpit, em `http://127.0.0.1:54324`.
- **Homologação e produção:** em Authentication → Emails, nos modelos **Confirm signup** e **Magic Link**, cole o HTML de `supabase/templates/codigo.html` (ele mostra `{{ .Token }}`, o código). Sem isso, o e-mail chega com um link em vez do código.
- O envio padrão de e-mails do Supabase tem limite baixo por hora e serve para testes. Antes de abrir para clientes, configure um serviço de e-mail próprio (SMTP) no painel.

## Cardápio (E04)

- Tabelas: `stations` (praças), `categories`, `products`, `product_variants` (tamanhos), `modifier_groups` e `modifiers` (adicionais), `product_modifier_groups`.
- **Dinheiro em centavos inteiros** (`price_cents`): R$ 14,00 = 1400. Use `formatarPreco` e `lerPreco` de `@usefood/core`; nunca guarde preço como número com vírgula.
- Toda loja nasce com a praça **Cozinha**. Produto sem praça vai para a praça padrão.
- Equipe da loja vê o cardápio; só dono e gerente editam. A vitrine vê só produtos ativos de lojas no ar. Testes em `supabase/tests/cardapio.test.sql`.
- Fotos ficam no bucket público `cardapio`, numa pasta por loja (`<restaurant_id>/arquivo.jpg`).

## PDV e pedidos (E05)

- O PDV fica em `/pdv` → **Abrir o PDV** (dono, gerente e caixa).
- Pedidos e pagamentos **só** nascem pelas funções `criar_pedido` e `registrar_pagamento`. Nenhum app grava direto nas tabelas `orders`, `order_items` e `payments`.
- `criar_pedido` recebe só produto e quantidade. O preço vem do cardápio no banco; a tela nunca define preço.
- Cada loja numera os pedidos do dia (#001, #002…) no próprio fuso; o número também serve de senha.
- Pagamento parcial é aceito. Só dinheiro pode passar do valor (gera troco). Garçom lança pedido, mas não cobra; cozinha não lança.
- Testes em `supabase/tests/pedidos.test.sql`.

## Design system

O visual segue o design system **usefood** (direção Pop). Os tokens dele ficam em `packages/ui/tokens/usefood.tokens.json`, e o `packages/ui/src/theme.css` é **gerado** a partir desse arquivo:

```bash
pnpm tokens
```

Nunca edite o `theme.css` à mão. Para mudar uma cor, fonte ou raio, atualize o design system, exporte o `tokens.json` para essa pasta e rode o comando.

As cores de cada marca (`brand`, `brand-ink`, `brand-soft`, `brand-text`) vêm do campo `theme` da tabela `brands`, com valores separados para o modo claro e o escuro. Só cores hexadecimais são aceitas; qualquer outra coisa é ignorada.

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
- Componentes do design system (E02, próxima etapa).
