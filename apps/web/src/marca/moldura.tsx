import { useAppContext } from '@usefood/app';
import { Button } from '@usefood/ui';
import { useEffect, type ReactNode } from 'react';

/** Páginas da marca têm visual fixo: não seguem o modo escuro do aparelho nem a escolha da pessoa. */
function useVisualFixo() {
  useEffect(() => {
    const raiz = document.documentElement;
    const antes = raiz.dataset.theme;
    raiz.dataset.theme = 'light';
    return () => {
      if (antes) raiz.dataset.theme = antes;
      else delete raiz.dataset.theme;
    };
  }, []);
}
import { navegar } from '../rotas';

/**
 * Marca escrita. O guia proíbe recriar o logo com fonte: quando chegarem os arquivos originais
 * (USE! e USE! FOOD), a imagem entra aqui, num lugar só.
 */
export function Marca() {
  const { brand } = useAppContext();
  return <span className="font-display text-wordmark text-ink">{brand}</span>;
}

/** Título e descrição da página (aba do navegador e buscadores). */
export function useSeo(titulo: string, descricao: string) {
  useEffect(() => {
    document.title = titulo;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'description';
      document.head.append(meta);
    }
    meta.content = descricao;
  }, [titulo, descricao]);
}

/** Topo e rodapé das páginas da marca (início, restaurantes e franquia). */
export function MolduraDaMarca({ children }: { children: ReactNode }) {
  useVisualFixo();
  const link = (rota: string, texto: string) => (
    <a
      href={rota}
      onClick={(e) => {
        e.preventDefault();
        navegar(rota);
      }}
      className="text-label text-ink-muted hover:text-ink"
    >
      {texto}
    </a>
  );
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="tema-escuro bg-canvas">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-5 pt-[max(1rem,calc(env(safe-area-inset-top)+0.5rem))] pb-4 lg:px-8">
          <a
            href="/"
            aria-label="Início"
            onClick={(e) => {
              e.preventDefault();
              navegar('/');
            }}
          >
            <Marca />
          </a>
          <nav aria-label="Páginas" className="flex flex-wrap items-center gap-5">
            {link('/restaurantes', 'Para restaurantes')}
            {link('/franquia', 'Franquia e parceiros')}
            <a href="/pdv">
              <Button variant="secondary" className="h-10">
                Entrar
              </Button>
            </a>
          </nav>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <footer className="tema-escuro bg-canvas text-ink">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-10 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <Marca />
          <p className="text-caption text-ink-muted">
            Restaurantes, lanches, pizzas, sorvetes e muito mais. © {new Date().getFullYear()}{' '}
            usefood.
          </p>
        </div>
      </footer>
    </div>
  );
}

/** Faixa escura do topo das páginas, com o laranja só nos destaques (texto grande). */
export function Destaque({ children }: { children: ReactNode }) {
  return (
    <section className="tema-escuro bg-canvas text-ink">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 pt-12 pb-16 lg:px-8 lg:pt-20 lg:pb-24">
        {children}
      </div>
    </section>
  );
}

/** Traço laranja embaixo dos títulos, como no guia. */
export const Traco = () => (
  <span aria-hidden="true" className="block h-1.5 w-14 rounded-pill bg-brand" />
);
