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
- Fotos ficam no bucket público `cardapio`, numa pasta por loja (`<restaurant_id>/arquivo.webp`). **Formato único 4:3 em todas as telas.** Ao escolher a foto, o dono enquadra no `ImageCropper` (arrastar e zoom); o navegador recorta e salva em até 1200 × 900, em WebP (JPG se o navegador não gerar WebP). **Ajustar enquadramento** reabre a moldura com a foto atual. A foto antiga é apagada ao trocar.
- Na tela: tocar no nome do produto abre o painel de edição (foto, dados, tamanhos, adicionais e excluir). A aba **Adicionais** cria grupos reaproveitáveis, com regra de mínimo e máximo, e os itens de cada grupo.
- No PDV, produto com tamanho ou adicionais abre o painel **Montar item**; o banco confere o tamanho e as regras de cada grupo.

## PDV e pedidos (E05)

- O PDV fica em `/pdv` → **Abrir o PDV** (dono, gerente e caixa).
- Pedidos e pagamentos **só** nascem pelas funções `criar_pedido` e `receber_conta`. Nenhum app grava direto nas tabelas `orders`, `order_items`, `tabs` e `payments`.
- `criar_pedido` recebe só produto e quantidade. O preço vem do cardápio no banco; a tela nunca define preço.
- Cada loja numera os pedidos do dia (#001, #002…) no próprio fuso; o número também serve de senha.
- Cada item pode levar `variant_id` (tamanho, obrigatório se o produto tem tamanhos), `adicionais` (ids) e `observacao`. O banco confere mínimo e máximo de cada grupo ligado ao produto e grava o tamanho e os adicionais como eram na hora (`order_item_modifiers`).
- Conta dividida: cada parte é um `receber_conta`. No dinheiro, `p_recebido_cents` informa a nota entregue e o troco sai sobre a parte. Só dinheiro tem troco. Garçom lança pedido, mas não cobra; cozinha não lança.
- Testes em `supabase/tests/pedidos.test.sql` e `supabase/tests/pedido_com_opcoes.test.sql`.

## Contas: pagar depois (antes da E08)

- Todo pedido pertence a uma **conta** (`tabs`). Balcão, retirada e delivery: cada pedido tem a sua. **Mesa**: as rodadas somam na conta aberta da mesa até ela ser paga (uma conta aberta por mesa).
- `criar_pedido` só lança: põe o pedido na conta e manda para a cozinha. Não cobra e não exige caixa aberto. No delivery e na retirada, guarda como o cliente vai pagar (`p_pagamento_previsto`) e o troco (`p_troco_para_cents`).
- `receber_conta` cobra a conta: inteira, em partes ou dividida, com troco por parte no dinheiro. A taxa de serviço de 10% (`p_taxa_servico`) é decidida no primeiro pagamento e não muda depois. Exige caixa aberto. Paga por completo, a conta fecha.
- No PDV: **Balcão, Mesa, Retirada ou Delivery**; **Enviar para a cozinha** (paga depois) ou **Cobrar agora**. A aba **Contas abertas** mostra mesas e pedidos a receber, com as rodadas, **Fechar conta** e **Nova rodada**.
- Testes em `supabase/tests/contas.test.sql`.

## Loja online, parte 1: dados, horários, entrega e publicação

- `/pdv` → **Loja online** (dono e gerente): situação (No ar, Em cadastro, Pausada) com a lista do que falta para publicar (`pendencias_para_publicar`), **Publicar a loja** (`publicar_loja`) e **Tirar do ar** (`pausar_loja`).
- **Dados**: descrição, WhatsApp, endereço com busca por CEP (ViaCEP) e **Usar a localização deste aparelho** (`definir_localizacao`, feito de dentro da loja).
- **Horários** (`opening_hours`): vários por dia; fechar depois da meia-noite vale (`loja_aberta_agora` entende a madrugada, no fuso da loja).
- **Entrega**: delivery e/ou retirada; taxa **grátis** (padrão, com raio opcional), **por bairro** (`delivery_districts`, comparado sem acento) ou **por distância** (`delivery_bands`, precisa da localização); pedido mínimo, grátis acima de um valor e tempo de entrega.
- Testes em `supabase/tests/loja_online.test.sql`.

## Conta do cliente neste aparelho

- Criada sozinha no primeiro pedido online: nome, celular e o endereço (com nome: "Casa"). Fica no aparelho (`usefood.conta` no armazenamento do navegador), não no servidor: sem confirmar o celular por código, qualquer um veria os endereços de outra pessoa digitando o número dela. Quando entrar a conta única (bloco 3, com código no celular), estes dados sobem para o servidor.
- **Minha conta** (`/<loja>/conta`, botão no canto do banner): nome e celular, vários endereços com nome (adicionar, editar, remover) e Meus pedidos.
- Checkout: escolhe o endereço salvo numa lista (`SelectField`) ou "Outro endereço" para digitar e, se quiser, salvar com um nome.
- Card no topo da loja enquanto houver pedido em andamento (aguardando, em preparo, pronto, saiu para entrega), levando ao acompanhamento.
- Topo da loja: banner 5:2 (capa salva em 1500 × 600) e três cards com ícone: tempo, entrega e pedido mínimo.

## Delivery pelo PDV e ticket de entrega

- No PDV e na comanda, o tipo **Delivery** pede celular, endereço (CEP com busca, rua, número, complemento, bairro, cidade, referência) e taxa de entrega; a taxa vem sugerida pela configuração da loja (`calcular_entrega`) e a equipe pode mudar. `criar_pedido` recebe `p_celular`, `p_endereco` e `p_taxa_entrega_cents` e exige rua, número e bairro no delivery.
- O ticket da cozinha de delivery traz, no topo, o bloco de entrega: nome, telefone, endereço com bairro e referência e **COBRAR R$ X - forma** (com o troco) ou **JA PAGO**. Na retirada, nome e telefone. Vale para pedidos do PDV e para os online (impressos no aceite). Precisa do programa de impressão atualizado.

## Aceite e entrega (loja online, parte 3)

- PDV: faixa amarela **pedidos online esperando a loja**, com bipe (`PedidosOnline`). **Aceitar** (`aceitar_pedido`, caixa, gerente ou dono) manda para a cozinha e para a impressora; **Recusar** (`recusar_pedido`) exige o motivo, que o cliente vê, e cancela a conta.
- Função nova na equipe: **Entregador** (`restaurant_role` `entregador`). Em `/garcom`, com o PIN dele, aparece **Entregas**: Prontos (com quanto cobrar e o troco) → **Saí para entrega** (`sair_para_entrega`) → Comigo (mapa, ligar, código) → **Confirmar entrega** (`confirmar_entrega`, só com os 4 últimos números do celular do cliente; pedido de PDV sem celular conclui sem código).
- Tela da cozinha: pedido de entrega pronto mostra "Esperando o entregador" no lugar de Entregue.
- O dinheiro recebido na porta entra no caixa quando o entregador volta (Contas abertas no PDV).
- Testes em `supabase/tests/aceite_e_entrega.test.sql`.

## Loja online do cliente (parte 2b)

- `apps/web`: `usefood.com.br/<loja>` (ou a raiz do domínio próprio da loja). Capa (3:1) e logo, aberto ou fechado com o horário de hoje, resumo da entrega, WhatsApp, cardápio por categoria (fotos 4:3, Montar item) e **sacola** guardada no aparelho.
- **Checkout**: entregar ou retirar, nome e celular, endereço com CEP (ViaCEP) e localização do aparelho, taxa perguntada ao banco enquanto a pessoa digita (`calcular_entrega`), pagamento na entrega ou retirada com troco, observação. Nome, celular e endereço ficam guardados para o próximo pedido.
- **Acompanhamento**: `/<loja>/pedido/<token>` (`acompanhar_pedido`), atualiza a cada 10 s: linha do tempo (enviado, em preparo, saiu para entrega ou pronto para retirar, entregue), código de entrega, itens, total e WhatsApp da loja.
- Rotas sem biblioteca: `useCaminho` e `navegar` (`apps/web/src/rotas.ts`).

## Pedido online (loja online, parte 2a)

- O cliente pede sem login, com nome e celular: `fazer_pedido_online` (anon). Confere loja no ar, aberta no horário, entrega ou retirada aceita, celular com DDD e no máximo 3 pedidos aguardando por celular a cada 30 minutos.
- Preço e taxa de entrega saem do banco: `calcular_entrega` (grátis com raio ou cidade, por bairro sem acento ou por distância em faixas; pedido mínimo; grátis acima de um valor). O checkout mostra a taxa antes; o pedido confere de novo.
- O pedido nasce **aguardando** (situação nova do pedido) e só imprime depois que a loja aceitar (parte 3). A conta guarda nome, celular, endereço, ponto no mapa, distância e taxa de entrega (que entra no total).
- `acompanhar_pedido(token)` alimenta a página do cliente pelo link secreto (`orders.tracking_token`), com o código de entrega: os 4 últimos números do celular.
- Logo (quadrado, 512 px) e capa (3:1, 1500 × 500) em **Loja online**, com o mesmo enquadramento das fotos.
- A montagem do pedido ficou em `private.montar_pedido`; `criar_pedido_sem_impressao` confere a equipe e chama ela.
- Testes em `supabase/tests/pedido_online.test.sql`.

## Para viagem por item

- Antes de enviar para a cozinha (PDV e comanda), a lista do pedido (`CartList`) tem **Comer aqui | Para viagem** para o pedido todo e a etiqueta **Pra viagem** em cada item, para misturar (comer um lanche e levar outro). Na mesa, tudo fica na mesma conta, até um pedido só para viagem.
- Cada item manda `para_viagem` em `p_itens`; o banco grava `order_items.to_go`. Pedidos Para viagem e Delivery saem sempre embalados.
- Cozinha: pedido todo para viagem ganha a faixa **PARA VIAGEM** (ou **DELIVERY**) no cartão e, no ticket, a mesma faixa grande em branco sobre preto; misturado, só os itens marcados. O ticket novo depende do programa de impressão atualizado (baixar de novo em `/downloads`).
- Testes em `supabase/tests/para_viagem.test.sql`.

## Comanda do garçom (E08, parte 2)

- Em `/garcom`, depois do PIN: **Salão** (as mesmas mesas do PDV) e **Prontos**.
- Mesa livre: abre o cardápio para a primeira rodada. Mesa ocupada: mostra as rodadas (Em preparo, Pronto, Entregue), o consumo e **Nova rodada**.
- Cardápio no celular: categorias em chips, produtos com foto em 2 colunas, o mesmo **Montar item** do PDV e a barra **Ver pedido** → **Enviar para a cozinha** (`criar_pedido` de mesa, que soma na conta aberta da mesa).
- **Novo pedido**: o garçom lança com os mesmos tipos do PDV (Comer aqui, Mesa, Para viagem, Delivery), com a mesma identificação e a forma de pagamento prevista. A conta fica aberta para o caixa receber.
- A escolha do tipo e da identificação é o componente `TipoEIdentificacao` (`@usefood/pedidos`) e a regra `parametrosDoPedido` (`@usefood/core`), iguais no PDV e na comanda.
- **Prontos**: pedidos de mesa marcados como prontos na cozinha, em tempo real, com vibração do celular; **Entregue** (`marcar_entregue`) tira da lista. Garçom não fecha conta: quem recebe é o caixa.
- O Salão, o Montar item e o carregamento do cardápio ficam em `packages/pedidos` (`@usefood/pedidos`), usados pelo PDV e pela comanda.

## Equipe com PIN (E08, parte 1)

- **Equipe** (`/pdv` → Equipe, dono e gerente): adicionar pessoa com nome, função (garçom, caixa, cozinha; gerente só o dono adiciona) e PIN de 4 números, sem e-mail. Trocar PIN e remover.
- Quem entra só com PIN tem um usuário próprio com e-mail interno (`equipe-…@equipe.usefood.app`), criado pela Edge Function `equipe-gestao`. Pedidos lançados ficam com `created_by` dessa pessoa.
- **Aparelhos da equipe**: o celular ou o tablet é conectado uma vez com código (`criar_codigo_de_pareamento(loja, 'equipe')`). O aparelho guarda um token próprio; só aparelho conectado aceita PIN.
- **Entrar** (`/garcom`): PIN no `PinPad` → Edge Function `equipe-acesso` → `entrar_com_pin` (no banco, só `service_role`) → acesso de uso único (`verifyOtp`). 5 PINs errados travam o aparelho por 5 minutos.
- O PIN é guardado com bcrypt (`staff_pins.pin_hash`), PIN único dentro da loja, e a coluna do hash nunca sai pela API.
- Testes em `supabase/tests/equipe.test.sql`.

## Salão e jeito de atender

- **Configurações** (`/pdv` → Configurações, dono e gerente):
  - Comer no local pedindo no balcão: o **cliente busca** (é chamado pela senha ou pelo nome) ou o **garçom leva até a mesa** (o PDV pede a mesa e não chama ninguém). Coluna `restaurants.counter_dine_in`.
  - Chamar o cliente por **senha** ou **nome** (para viagem e balcão com retirada). Coluna `restaurants.call_by`.
  - **Mesas** (`dining_tables`), com área (Salão, Varanda). `criar_mesas` cria um intervalo de uma vez e mantém as que já existem.
- **PDV**: tipos **Comer aqui**, **Mesa**, **Para viagem** e **Delivery**; o que o PDV pede em cada um vem de `identificacaoPara` (`@usefood/core`). O botão **Cardápio | Salão** troca a área principal pelo mapa das mesas: livre ou ocupada, valor, tempo e pedidos prontos para levar. Mesa ocupada abre a conta ao lado; mesa livre começa um pedido para ela.
- **Painel de chamada** (para a TV do balcão): **Preparando** e **Pronto! Pode retirar**, com bipe. Mostra pedidos para viagem e de balcão chamados por senha ou nome; o pronto sai do painel quando é marcado como entregue ou depois de 30 minutos.
- Segurança: pela API, a equipe só altera `name`, `timezone`, `call_by` e `counter_dine_in` da loja. Status, endereço e marca mudam só por funções do sistema.
- Testes em `supabase/tests/salao.test.sql`.

## Tela da cozinha (KDS)

- Em `/pdv` → **Tela da cozinha** (qualquer pessoa da equipe; é o botão principal para quem tem o papel Cozinha). Abre em tema escuro, em tela cheia.
- Escolha a praça (ou Todas); a escolha fica lembrada naquele aparelho. Cada pedido em preparo vira um cartão (`OrderCard`) com os itens daquela praça, adicionais, observação em destaque e o tempo de espera: normal até 8 min, amarelo até 15, vermelho depois.
- **Pronto** (`marcar_pronto`) marca a parte daquela praça. Quando todas as praças terminam, o pedido inteiro fica pronto e vai para **Prontos para entregar**, com **Entregue** (`marcar_entregue`) e **Desfazer** (`desfazer_pronto`).
- Atualiza em tempo real (Realtime na tabela `orders`) e a cada 15 s. **Ligar som** toca um bipe a cada pedido novo (o navegador exige um toque antes de liberar o som).
- Testes em `supabase/tests/cozinha.test.sql`.

## Caixa (E06)

- Ao abrir o PDV sem caixa aberto, o app pede o **fundo de troco** (`abrir_caixa`). Sem caixa aberto, `receber_conta` recusa: todo pagamento cai num turno (`payments.cash_session_id`).
- No PDV, o botão **Caixa** abre o resumo do turno, a sangria e o suprimento (`movimentar_caixa`, com motivo) e o fechamento.
- Dinheiro esperado na gaveta = fundo + vendas em dinheiro + suprimentos − sangrias (`resumo_do_caixa`). Vendas em dinheiro contam o valor da venda; o troco já saiu da nota recebida.
- No fechamento (`fechar_caixa`), a pessoa conta sem ver o esperado; a diferença fica gravada no turno ("Bateu certinho", "Sobrou", "Faltou").
- Um caixa aberto por vez em cada ponto de venda (`register_name`, hoje sempre "Caixa 1"). Vários caixas na mesma loja ficam para quando houver mais de um ponto de venda.
- Testes em `supabase/tests/caixa.test.sql`.

## Impressão na cozinha (E07)

- Cada pedido gera uma ordem de impressão (`print_jobs`) para cada impressora da praça de cada item: um ticket da Cozinha só com os itens da Cozinha, outro do Bar, e assim por diante. Praça sem impressora gera uma ordem já com falha, para o PDV avisar.
- **Agente** (`apps/print-agent`): programa do computador da loja. Recebe as ordens em tempo real (com varredura a cada 10 s como rede de segurança), reserva cada ordem (`pegar_impressao`, ninguém imprime duas vezes), formata em ESC/POS com acentos (página 850), manda para a impressora de rede na porta 9100 e confirma (`concluir_impressao`; com falha, tenta até 3 vezes). Avisa que está vivo a cada 15 s (`agente_presente`).
- **Pareamento:** o dono gera um código (`criar_codigo_de_pareamento`, 8 caracteres, 10 minutos) e roda no computador da loja `usefood-impressao parear <CÓDIGO> --servidor <URL do Supabase>`. A Edge Function `parear-impressora` cria um acesso próprio para aquele computador.
- Para gerar o programa: `pnpm --filter @usefood/print-agent build` → `apps/print-agent/dist/usefood-impressao.mjs`, que roda com `node` (22 ou mais novo). Teste sem o sistema: `node usefood-impressao.mjs testar-impressora 192.168.0.50`.
- Esta versão imprime em impressoras **de rede**. Impressoras USB e uma janela visual ficam para a versão em Tauri.
- **Na tela** (`/pdv` → **Impressão**, dono e gerente): computadores conectados (Ligado ou Desligado, pelo último sinal), **Conectar um computador** (gera o código e mostra o passo a passo com o comando pronto), praças, impressoras por praça (IP, porta, papel de 80 ou 58 mm) e **Imprimir teste**, que espera a confirmação da impressora.
- No editor de produto, **Sai na impressora de** escolhe a praça. Sem escolha, o produto sai na primeira praça (Cozinha).
- No PDV, avisos a cada 10 s: computador desligado, nenhum computador conectado, ticket que falhou (com **Reimprimir**) ou fila parada há mais de 20 s. Na tela do pedido pago, **Imprimir de novo**.
- O site publica o programa em `/downloads/usefood-impressao.mjs` (`scripts/montar-site.mjs`).
- Testes em `supabase/tests/impressao.test.sql` e em `apps/print-agent`.

## Design system

O visual segue o design system **usefood** (direção Pop). Os tokens dele ficam em `packages/ui/tokens/usefood.tokens.json`, e o `packages/ui/src/theme.css` é **gerado** a partir desse arquivo:

```bash
pnpm tokens
```

Nunca edite o `theme.css` à mão. Para mudar uma cor, fonte ou raio, atualize o design system, exporte o `tokens.json` para essa pasta e rode o comando.

**Componentes** ficam em `packages/ui` e são os mesmos que aparecem, com prévia ao vivo, no design system: Button, Chip, TextField, Switch, SegmentedControl, ChoiceGrid, ProductTile, QuantityStepper, StoreCard, BottomNav, Alert, StatusPill, EmptyState, Panel e Icon. Telas novas se montam com eles; não redesenhe um botão ou um card dentro de uma tela. Depois de mudar um componente, rode `pnpm ds:bundle` e publique `packages/ui/dist-ds/` no design system.

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
