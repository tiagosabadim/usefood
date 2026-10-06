import { Button, Icon, type IconName } from '@usefood/ui';
import { navegar } from '../rotas';
import { FormularioDeLead } from './formulario-de-lead';
import { Destaque, MolduraDaMarca, Traco, useSeo } from './moldura';

const irPara = (id: string) =>
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

function Cartoes({ itens }: { itens: { icone: IconName; titulo: string; texto: string }[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {itens.map((i) => (
        <li key={i.titulo} className="flex flex-col gap-3 rounded-lg bg-surface p-5">
          <span className="flex size-11 items-center justify-center rounded-pill bg-brand text-brand-ink">
            <Icon name={i.icone} size={22} />
          </span>
          <h3 className="text-body-strong text-ink">{i.titulo}</h3>
          <p className="text-body text-ink-muted">{i.texto}</p>
        </li>
      ))}
    </ul>
  );
}

function Secao({
  id,
  titulo,
  texto,
  children,
}: {
  id?: string;
  titulo: string;
  texto?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="mx-auto flex w-full max-w-6xl scroll-mt-6 flex-col gap-6 px-5 py-14 lg:px-8 lg:py-20"
    >
      <div className="flex max-w-2xl flex-col gap-3">
        <h2 className="font-display text-display text-ink">{titulo}</h2>
        <Traco />
        {texto && <p className="text-body text-ink-muted">{texto}</p>}
      </div>
      {children}
    </section>
  );
}

/** Início da marca (até a vitrine chegar): dois caminhos, restaurante ou franquia. */
export function InicioDaMarca() {
  useSeo(
    'usefood · Deu fome?',
    'O delivery da sua cidade. Restaurantes, lanches, pizzas, sorvetes e muito mais.',
  );
  return (
    <MolduraDaMarca>
      <Destaque>
        <h1 className="font-display text-[clamp(2.5rem,7vw,4.5rem)] leading-[1.05] font-black tracking-tight">
          Deu fome<span className="text-brand">?</span>
        </h1>
        <Traco />
        <p className="max-w-xl text-body text-canvas/80">
          Restaurantes, lanches, pizzas, sorvetes e muito mais. O delivery da sua cidade está
          chegando.
        </p>
      </Destaque>
      <div className="mx-auto grid w-full max-w-6xl gap-4 px-5 py-14 sm:grid-cols-2 lg:px-8">
        {[
          {
            icone: 'loja' as const,
            titulo: 'Tenho um restaurante',
            texto: 'PDV, cardápio online, delivery e os seus clientes em um só lugar.',
            rota: '/restaurantes',
          },
          {
            icone: 'globo' as const,
            titulo: 'Quero levar o USE! para minha cidade',
            texto: 'Seja franqueado ou parceiro e conecte os restaurantes da sua região.',
            rota: '/franquia',
          },
        ].map((c) => (
          <button
            key={c.rota}
            type="button"
            onClick={() => navegar(c.rota)}
            className="flex flex-col items-start gap-4 rounded-lg bg-surface p-6 text-left transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <span className="flex size-12 items-center justify-center rounded-pill bg-brand text-brand-ink">
              <Icon name={c.icone} size={24} />
            </span>
            <span className="font-display text-title-screen text-ink">{c.titulo}</span>
            <span className="text-body text-ink-muted">{c.texto}</span>
            <span className="text-label text-brand-text">Saiba mais →</span>
          </button>
        ))}
      </div>
    </MolduraDaMarca>
  );
}

/** Landing para captar restaurantes. Só mostra o que o sistema já faz; preço é conversa. */
export function LandingRestaurantes() {
  useSeo(
    'usefood para restaurantes · PDV, cardápio online e delivery',
    'PDV, mesas, cozinha, impressão, loja online com o seu endereço, entregas e os seus clientes em um só sistema.',
  );
  return (
    <MolduraDaMarca>
      <Destaque>
        <span className="text-label text-brand">Para restaurantes</span>
        <h1 className="max-w-3xl font-display text-[clamp(2.25rem,6vw,4rem)] leading-[1.05] font-black tracking-tight">
          Venda mais, com os <span className="text-brand">clientes sendo seus.</span>
        </h1>
        <p className="max-w-2xl text-body text-canvas/80">
          PDV, mesas, cozinha, impressão, loja online com o seu endereço e entregas, tudo num
          sistema só. E a lista de quem compra de você fica com você, com nome, WhatsApp e o que
          cada um mais pede.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button className="h-target-pdv" onClick={() => irPara('quero')}>
            Quero conhecer
          </Button>
          <Button variant="secondary" className="h-target-pdv" onClick={() => irPara('recursos')}>
            Ver o que tem
          </Button>
        </div>
      </Destaque>

      <Secao
        id="recursos"
        titulo="Tudo o que o restaurante precisa"
        texto="Funciona no computador, no tablet e no celular, inclusive em quem tem um notebook só."
      >
        <Cartoes
          itens={[
            {
              icone: 'pdv',
              titulo: 'PDV rápido',
              texto: 'Balcão, mesa, para viagem e delivery, com caixa e fechamento.',
            },
            {
              icone: 'mesa',
              titulo: 'Mesas e comanda',
              texto: 'O garçom lança pelo celular, com PIN, e a conta da mesa soma as rodadas.',
            },
            {
              icone: 'cozinha',
              titulo: 'Tela da cozinha',
              texto:
                'Pedidos por praça, com cronômetro, e o aviso de pronto para o garçom e o balcão.',
            },
            {
              icone: 'impressora',
              titulo: 'Impressão',
              texto: 'Ticket na impressora térmica de rede, com o pedido e os dados da entrega.',
            },
            {
              icone: 'loja',
              titulo: 'Loja online sua',
              texto: 'Cardápio com fotos no seu endereço, com checkout e acompanhamento do pedido.',
            },
            {
              icone: 'moto',
              titulo: 'Entregas com código',
              texto: 'O entregador só conclui com o código do cliente, e você é avisado na hora.',
            },
            {
              icone: 'perfil',
              titulo: 'Seus clientes',
              texto: 'Quem pediu, quanto gastou, o favorito e quem sumiu. Exporte quando quiser.',
            },
            {
              icone: 'grafico',
              titulo: 'Números do dia',
              texto:
                'Vendas, ticket médio, horários de pico e os mais vendidos, comparando períodos.',
            },
          ]}
        />
      </Secao>

      <section className="bg-surface">
        <Secao titulo="Como começar">
          <ol className="grid gap-4 lg:grid-cols-3">
            {[
              ['1', 'Conversa rápida', 'Entendemos como o seu restaurante funciona hoje.'],
              [
                '2',
                'Cardápio no ar',
                'Você cadastra os produtos com fotos, e a gente ajuda no que precisar.',
              ],
              [
                '3',
                'Vendendo',
                'PDV no balcão, loja online no Instagram e no WhatsApp, pedidos chegando.',
              ],
            ].map(([n, t, x]) => (
              <li key={n} className="flex flex-col gap-2 rounded-lg bg-canvas p-5">
                <span className="font-display text-display text-brand-text">{n}</span>
                <span className="text-body-strong text-ink">{t}</span>
                <span className="text-body text-ink-muted">{x}</span>
              </li>
            ))}
          </ol>
        </Secao>
      </section>

      <Secao
        id="quero"
        titulo="Vamos conversar?"
        texto="Deixe seus dados e chamamos você no WhatsApp para mostrar o sistema e montar o plano ideal para o seu porte."
      >
        <div className="max-w-3xl">
          <FormularioDeLead
            tipo="restaurante"
            titulo="Quero conhecer o usefood"
            botao="Quero conhecer"
            extras={[
              { chave: 'negocio', rotulo: 'Nome do restaurante', obrigatorio: true },
              {
                chave: 'segmento',
                rotulo: 'Tipo',
                opcoes: [
                  'Lanches',
                  'Pizzaria',
                  'Restaurante',
                  'Marmitaria',
                  'Doces e sorvetes',
                  'Bebidas',
                  'Outro',
                ],
              },
              {
                chave: 'porte',
                rotulo: 'Pedidos por dia',
                opcoes: ['Até 30', '30 a 100', '100 a 300', 'Mais de 300'],
              },
            ]}
          />
        </div>
      </Secao>

      <section className="bg-surface">
        <Secao titulo="Perguntas frequentes">
          <dl className="grid gap-4 lg:grid-cols-2">
            {[
              [
                'Preciso de um computador novo?',
                'Não. Funciona no navegador do computador, do tablet ou do celular que você já tem.',
              ],
              [
                'Funciona com a minha impressora?',
                'Funciona com impressoras térmicas de rede (as de cupom, ligadas no cabo de rede), que são as mais comuns na cozinha.',
              ],
              [
                'Os dados dos clientes são meus?',
                'Sim. Você vê e exporta a lista de quem pediu por delivery, retirada e loja online.',
              ],
              [
                'Quanto custa?',
                'Depende do porte e do que você vai usar. Na conversa a gente monta o plano certo para você.',
              ],
            ].map(([p, r]) => (
              <div key={p} className="flex flex-col gap-2 rounded-lg bg-canvas p-5">
                <dt className="text-body-strong text-ink">{p}</dt>
                <dd className="text-body text-ink-muted">{r}</dd>
              </div>
            ))}
          </dl>
        </Secao>
      </section>
    </MolduraDaMarca>
  );
}

/** Landing para franqueados e parceiros. Sem prometer condições (o modelo ainda está sendo definido). */
export function LandingFranquia() {
  useSeo(
    'Franquia e parceiros usefood · Leve o USE! para a sua cidade',
    'Estamos procurando franqueados e parceiros para levar o USE! para cidades pequenas e médias.',
  );
  return (
    <MolduraDaMarca>
      <Destaque>
        <span className="text-label text-brand">Franquia e parceiros</span>
        <h1 className="max-w-3xl font-display text-[clamp(2.25rem,6vw,4rem)] leading-[1.05] font-black tracking-tight">
          Leve o USE! para a <span className="text-brand">sua cidade.</span>
        </h1>
        <p className="max-w-2xl text-body text-canvas/80">
          Estamos procurando franqueados e parceiros para conectar os restaurantes de cidades
          pequenas e médias a um delivery da própria cidade.
        </p>
        <div>
          <Button className="h-target-pdv" onClick={() => irPara('quero')}>
            Quero ser parceiro
          </Button>
        </div>
      </Destaque>

      <Secao
        titulo="Para quem é"
        texto="Para quem conhece o comércio da cidade e quer construir algo local, com uma plataforma completa por trás."
      >
        <Cartoes
          itens={[
            {
              icone: 'globo',
              titulo: 'Empreendedores locais',
              texto: 'Quem quer um negócio na própria cidade, perto dos restaurantes.',
            },
            {
              icone: 'marca',
              titulo: 'Agências e consultores',
              texto: 'Quem já atende comércios e quer oferecer delivery próprio a eles.',
            },
            {
              icone: 'loja',
              titulo: 'Donos de restaurante',
              texto: 'Quem já é do ramo e quer liderar o delivery da região.',
            },
            {
              icone: 'equipe',
              titulo: 'Equipes comerciais',
              texto: 'Quem sabe vender e acompanhar clientes de perto.',
            },
          ]}
        />
      </Secao>

      <section className="bg-surface">
        <Secao titulo="O que você leva para a cidade">
          <Cartoes
            itens={[
              {
                icone: 'pdv',
                titulo: 'Sistema completo',
                texto:
                  'PDV, mesas, cozinha, impressão, loja online e entregas para cada restaurante.',
              },
              {
                icone: 'perfil',
                titulo: 'Clientes do restaurante',
                texto:
                  'Um diferencial que os apps grandes não entregam: a lista de clientes é do restaurante.',
              },
              {
                icone: 'moto',
                titulo: 'Delivery local',
                texto: 'Entrega com código de confirmação e acompanhamento do pedido pelo cliente.',
              },
              {
                icone: 'grafico',
                titulo: 'Números',
                texto: 'Cada restaurante acompanha vendas e clientes, e você acompanha a cidade.',
              },
            ]}
          />
        </Secao>
      </section>

      <Secao
        id="quero"
        titulo="Vamos conversar?"
        texto="Conte um pouco sobre você e a sua cidade. Nossa equipe chama você no WhatsApp para apresentar o modelo."
      >
        <div className="max-w-3xl">
          <FormularioDeLead
            tipo="franquia"
            titulo="Quero levar o USE! para minha cidade"
            botao="Quero ser parceiro"
            extras={[
              {
                chave: 'segmento',
                rotulo: 'Como quer participar',
                opcoes: ['Franqueado', 'Parceiro comercial', 'Agência', 'Ainda não sei'],
                obrigatorio: true,
              },
              { chave: 'mensagem', rotulo: 'Conte um pouco sobre você (opcional)' },
            ]}
          />
        </div>
      </Secao>
    </MolduraDaMarca>
  );
}
