import { Icon } from '@usefood/ui';
import { Destaque, MolduraDaMarca, Traco, useSeo } from './moldura';

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
            onClick={() => window.location.assign(c.rota)}
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
